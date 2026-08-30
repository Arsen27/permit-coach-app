import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearAssets } from '@/data/assets/store';

import { createLogger, formatBytes } from '@/lib/log';

import { CourseId, DEFAULT_COURSE_ID } from './index';
import type { CourseBundleV2, CourseDocV2, ModuleDocV2 } from './v2/wire';
import { COURSE_SCHEMA_VERSION } from './v2/wire';

// Device store for downloaded courses (v2 block-based format). Nothing ships
// in the binary: until a version of the active course has been committed the
// store serves null, and the app gates on that — onboarding downloads the
// learner's state course before the paywall, and an onboarded device whose
// store holds no course sees the download screen instead of the shell. A
// commit stages all docs, re-reads and verifies what was staged, switches the
// meta pointer last, then sweeps other versions of that course — a kill at
// any point leaves a consistent course.
//
// Size note: one committed v2 course (with embedded SVG) is ~2MB of JSON, and
// the courses of previously chosen states are kept so switching back needs no
// download. Android's AsyncStorage database is sized for several in
// android/gradle.properties (AsyncStorage_db_size_in_MB).

const V1_PREFIX = 'dmv-prep/course/v1/';
const prefixFor = (courseId: string) => `dmv-prep/course/v2/${courseId}`;
const metaKey = (courseId: string) => `${prefixFor(courseId)}/meta`;
const courseKey = (courseId: string, semver: string) =>
  `${prefixFor(courseId)}/${semver}/course`;
const moduleKey = (courseId: string, semver: string, moduleId: string) =>
  `${prefixFor(courseId)}/${semver}/modules/${moduleId}`;

export type StoredCourse = {
  deliveryVersion: string;
  bundle: CourseBundleV2;
};

type Meta = {
  deliveryVersion: string;
  moduleIds: string[];
};

const log = createLogger('store');

// One slot per course; the active course decides what getSnapshot serves.
// Hydrated slots are kept, so switching state back and forth never re-reads
// storage.
let activeCourseId: CourseId = DEFAULT_COURSE_ID;
const snapshots = new Map<CourseId, StoredCourse>();
const hydratedCourses = new Set<CourseId>();
const hydratingCourses = new Map<CourseId, Promise<void>>();
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach(listener => listener());
};

export const assembleBundle = (
  courseDoc: CourseDocV2,
  moduleDocs: ModuleDocV2[],
): CourseBundleV2 => {
  const byId = new Map(moduleDocs.map(doc => [doc.module.moduleId, doc]));
  const ordered = courseDoc.course.moduleIds
    .map(id => byId.get(id))
    .filter((doc): doc is ModuleDocV2 => doc != null);
  const seenQuestions = new Set<string>();
  const seenAssets = new Set<string>();
  return {
    course: courseDoc.course,
    modules: ordered.map(doc => doc.module),
    questions: ordered.flatMap(doc =>
      doc.questions.filter(question => {
        if (seenQuestions.has(question.questionId)) {
          return false;
        }
        seenQuestions.add(question.questionId);
        return true;
      }),
    ),
    assets: ordered.flatMap(doc =>
      doc.assets.filter(asset => {
        if (seenAssets.has(asset.assetId)) {
          return false;
        }
        seenAssets.add(asset.assetId);
        return true;
      }),
    ),
  };
};

// Removes every other v2 version of the course, plus the abandoned v1
// namespace (the old article-based course store) best-effort.
const sweep = async (
  courseId: CourseId,
  keepSemver: string | null,
): Promise<void> => {
  const prefix = prefixFor(courseId);
  const keys = (await AsyncStorage.getAllKeys()).filter(
    key =>
      key.startsWith(V1_PREFIX) ||
      (key.startsWith(`${prefix}/`) &&
        key !== metaKey(courseId) &&
        (keepSemver == null || !key.startsWith(`${prefix}/${keepSemver}/`))),
  );
  if (keys.length > 0) {
    await AsyncStorage.removeMany(keys);
  }
};

const hydrateCourse = async (courseId: CourseId): Promise<void> => {
  let committedSemver: string | null = null;
  try {
    const rawMeta = await AsyncStorage.getItem(metaKey(courseId));
    if (rawMeta != null) {
      const meta = JSON.parse(rawMeta) as Meta;
      const entries = await AsyncStorage.getMany([
        courseKey(courseId, meta.deliveryVersion),
        ...meta.moduleIds.map(id =>
          moduleKey(courseId, meta.deliveryVersion, id),
        ),
      ]);
      const rawCourse = entries[courseKey(courseId, meta.deliveryVersion)];
      const rawModules = meta.moduleIds.map(
        id => entries[moduleKey(courseId, meta.deliveryVersion, id)],
      );
      if (rawCourse != null && rawModules.every(value => value != null)) {
        const courseDoc = JSON.parse(rawCourse) as CourseDocV2;
        const moduleDocs = rawModules.map(
          value => JSON.parse(value as string) as ModuleDocV2,
        );
        if (
          courseDoc.schemaVersion !== COURSE_SCHEMA_VERSION ||
          moduleDocs.some(doc => doc.schemaVersion !== COURSE_SCHEMA_VERSION)
        ) {
          throw new Error('stored docs carry an unsupported schemaVersion');
        }
        const hydratedSnapshot = {
          deliveryVersion: meta.deliveryVersion,
          bundle: assembleBundle(courseDoc, moduleDocs),
        };
        snapshots.set(courseId, hydratedSnapshot);
        committedSemver = meta.deliveryVersion;
        log.info(`hydrated ${courseId}@${meta.deliveryVersion} from storage`, {
          modules: hydratedSnapshot.bundle.modules.length,
          questions: hydratedSnapshot.bundle.questions.length,
          assets: hydratedSnapshot.bundle.assets.length,
        });
      } else {
        // Corrupted store — clear the bad pointer; the course has to be
        // downloaded again.
        log.warn(
          `corrupted store for ${courseId}@${meta.deliveryVersion}: docs missing — the course must be downloaded again`,
        );
        snapshots.delete(courseId);
        await AsyncStorage.removeItem(metaKey(courseId));
      }
    } else {
      log.info(`no committed ${courseId} version on this device`);
    }
  } catch (error) {
    log.error(
      `hydrate ${courseId} failed — the course must be downloaded again`,
      error,
    );
    snapshots.delete(courseId);
    await AsyncStorage.removeItem(metaKey(courseId)).catch(() => undefined);
  }
  hydratedCourses.add(courseId);
  notify();
  sweep(courseId, committedSemver).catch(() => undefined);
};

const ensureHydrated = (courseId: CourseId): Promise<void> => {
  let promise = hydratingCourses.get(courseId);
  if (promise == null) {
    promise = hydrateCourse(courseId);
    hydratingCourses.set(courseId, promise);
  }
  return promise;
};

// Every key a downloaded course and its cursors occupy. The channel switch
// clears them because what they hold came from the other channel — a stale
// version number there would be read as progress the device had made.
const OWNED_PREFIXES = [
  'dmv-prep/course/v2/',
  V1_PREFIX,
  'dmv-prep/course-seen/v2/',
  'dmv-prep/course-offer/v1/',
  'dmv-prep/course-prompts/v1',
];

export const courseStore = {
  activeCourseId: (): CourseId => activeCourseId,
  // The committed course for the active state, or null before hydration and
  // when nothing has been committed for it.
  getSnapshot: (): StoredCourse | null => snapshots.get(activeCourseId) ?? null,
  isHydrated: (): boolean => hydratedCourses.has(activeCourseId),
  hydrate: (): Promise<void> => ensureHydrated(activeCourseId),
  // Hydrates a specific course (active or not) and answers what is committed
  // for it — what a state switch asks before deciding whether to download.
  hydrateCourse: async (courseId: CourseId): Promise<StoredCourse | null> => {
    await ensureHydrated(courseId);
    return snapshots.get(courseId) ?? null;
  },
  // What is in memory for a course right now, hydrated or not.
  storedFor: (courseId: CourseId): StoredCourse | null =>
    snapshots.get(courseId) ?? null,
  // Every picture any course on this device shows. The courses of previously
  // chosen states are kept so switching back needs no download — a sweep that
  // only kept the course just committed took their pictures away. Which
  // courses those are is read off the store itself: the set of states is the
  // server's now, and a course downloaded by a later build of the catalogue
  // is still on this phone.
  artworkOnDevice: async (): Promise<Set<string>> => {
    const shown = new Set<string>();
    const keys = await AsyncStorage.getAllKeys();
    const owners = new Set(
      keys.flatMap(key => {
        const match = /^dmv-prep\/course\/v2\/([^/]+)\/meta$/.exec(key);
        return match == null ? [] : [match[1] as CourseId];
      }),
    );
    for (const courseId of owners) {
      await ensureHydrated(courseId);
      snapshots
        .get(courseId)
        ?.bundle.assets.forEach(asset => shown.add(asset.sha256));
    }
    return shown;
  },
  // Forgets every downloaded course and cursor, leaving the store exactly as
  // empty as a fresh install. Dev-only in practice: the channel switch calls
  // it, and the caller downloads the new channel's course afterwards.
  wipeDownloadedContent: async (): Promise<void> => {
    await clearAssets();
    const keys = (await AsyncStorage.getAllKeys()).filter(key =>
      OWNED_PREFIXES.some(prefix => key.startsWith(prefix)),
    );
    if (keys.length > 0) {
      await AsyncStorage.removeMany(keys);
    }
    snapshots.clear();
    hydratedCourses.clear();
    hydratingCourses.clear();
    notify();
  },
  // Switches which course the store serves (the learner changed state). The
  // caller makes sure that course is on the device first; a committed
  // version serves the moment its hydration lands.
  setActiveCourse: (courseId: CourseId): void => {
    if (courseId === activeCourseId) {
      return;
    }
    activeCourseId = courseId;
    notify();
    ensureHydrated(courseId).catch(() => undefined);
  },
  commit: async (
    deliveryVersion: string,
    courseDoc: CourseDocV2,
    moduleDocs: ModuleDocV2[],
  ): Promise<void> => {
    const elapsed = log.time();
    // A commit belongs to the course named in the doc, not to whichever
    // course is active: a state switch mid-download cannot cross the streams,
    // and a course downloaded ahead of a switch lands in its own slot.
    const courseId = courseDoc.course.courseId as CourseId;
    const staged: Record<string, string> = {
      [courseKey(courseId, deliveryVersion)]: JSON.stringify(courseDoc),
      ...Object.fromEntries(
        moduleDocs.map(doc => [
          moduleKey(courseId, deliveryVersion, doc.module.moduleId),
          JSON.stringify(doc),
        ]),
      ),
    };
    const bytes = Object.values(staged).reduce(
      (sum, value) => sum + value.length,
      0,
    );
    await AsyncStorage.setMany(staged);
    // Re-read what was staged and verify it survived the round trip before
    // the meta pointer makes it live.
    const reread = await AsyncStorage.getMany(Object.keys(staged));
    for (const [key, expected] of Object.entries(staged)) {
      if (reread[key] !== expected) {
        await AsyncStorage.removeMany(Object.keys(staged)).catch(
          () => undefined,
        );
        throw new Error(`staged doc verification failed for ${key}`);
      }
    }
    const meta: Meta = {
      deliveryVersion,
      moduleIds: courseDoc.course.moduleIds,
    };
    await AsyncStorage.setItem(metaKey(courseId), JSON.stringify(meta));
    const committed = {
      deliveryVersion,
      bundle: assembleBundle(courseDoc, moduleDocs),
    };
    snapshots.set(courseId, committed);
    // A committed course is by definition hydrated, whether or not storage
    // was ever read for it.
    hydratedCourses.add(courseId);
    log.info(
      `committed ${courseId}@${deliveryVersion} (${elapsed()}ms, ${formatBytes(
        bytes,
      )})`,
      {
        modules: moduleDocs.length,
        lessons: committed.bundle.modules.reduce(
          (sum, module) => sum + module.lessons.length,
          0,
        ),
        questions: committed.bundle.questions.length,
        assets: committed.bundle.assets.length,
      },
    );
    notify();
    sweep(courseId, deliveryVersion).catch(() => undefined);
  },
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  // Test seam: back to the pristine empty state.
  resetForTests: (): void => {
    activeCourseId = DEFAULT_COURSE_ID;
    snapshots.clear();
    hydratedCourses.clear();
    hydratingCourses.clear();
    listeners.clear();
  },
};
