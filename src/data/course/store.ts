import AsyncStorage from '@react-native-async-storage/async-storage';

import { createLogger, formatBytes } from '@/lib/log';

import { COURSE_SEEDS, DEFAULT_COURSE_ID, SeedCourseId } from './index';
import type { CourseBundleV2, CourseDocV2, ModuleDocV2 } from './v2/wire';
import { COURSE_SCHEMA_VERSION } from './v2/wire';

// Device store for the downloaded course (v2 block-based format). The bundled
// seed serves synchronously until a server version has been committed, so the
// app works with zero async and fully offline; the seed itself is never
// written to AsyncStorage. A commit stages all docs, re-reads and verifies
// what was staged, switches the meta pointer last, then sweeps other versions
// — a kill at any point leaves a consistent course.
//
// Size note: one committed v2 course (with embedded SVG) is ~1.5MB of JSON.
// Android's AsyncStorage database defaults to 6MB total; if we ever store
// multiple courses, bump AsyncStorage_db_size_in_MB in android/gradle.properties.

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

const seedSnapshot = (courseId: SeedCourseId): StoredCourse =>
  COURSE_SEEDS[courseId];

// One snapshot slot per course; the active course decides what getSnapshot
// serves. Hydrated slots are kept, so switching state back and forth never
// re-reads storage.
let activeCourseId: SeedCourseId = DEFAULT_COURSE_ID;
const snapshots = new Map<SeedCourseId, StoredCourse>();
const hydratedCourses = new Set<SeedCourseId>();
const hydratingCourses = new Map<SeedCourseId, Promise<void>>();
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

// Removes every other v2 version, plus the abandoned v1 namespace (the old
// article-based course store) best-effort.
const sweep = async (
  courseId: SeedCourseId,
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

const hydrateCourse = async (courseId: SeedCourseId): Promise<void> => {
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
        // Corrupted store — fall back to the seed and clear the bad pointer.
        log.warn(
          `corrupted store for ${courseId}@${meta.deliveryVersion}: docs missing — falling back to the seed`,
        );
        await AsyncStorage.removeItem(metaKey(courseId));
      }
    } else {
      log.info(
        `no committed ${courseId} version — serving the bundled seed ${
          seedSnapshot(courseId).deliveryVersion
        }`,
      );
    }
  } catch (error) {
    log.error(
      `hydrate ${courseId} failed — falling back to the bundled seed`,
      error,
    );
    snapshots.delete(courseId);
    await AsyncStorage.removeItem(metaKey(courseId)).catch(() => undefined);
  }
  hydratedCourses.add(courseId);
  notify();
  sweep(courseId, committedSemver).catch(() => undefined);
};

const ensureHydrated = (courseId: SeedCourseId): Promise<void> => {
  let promise = hydratingCourses.get(courseId);
  if (promise == null) {
    promise = hydrateCourse(courseId);
    hydratingCourses.set(courseId, promise);
  }
  return promise;
};

export const courseStore = {
  activeCourseId: (): SeedCourseId => activeCourseId,
  getSnapshot: (): StoredCourse =>
    snapshots.get(activeCourseId) ?? seedSnapshot(activeCourseId),
  isHydrated: (): boolean => hydratedCourses.has(activeCourseId),
  hydrate: (): Promise<void> => ensureHydrated(activeCourseId),
  // Switches which course the store serves (the learner changed state). The
  // seed for the new course serves synchronously; a committed server version
  // swaps in when its hydration lands.
  setActiveCourse: (courseId: SeedCourseId): void => {
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
    // A commit belongs to the course named in the doc, which the updater
    // fetched for the course active at the time — pin it so a state switch
    // mid-download cannot cross the streams.
    const courseId = courseDoc.course.courseId as SeedCourseId;
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
  // Test seam: back to the pristine seed state.
  resetForTests: (): void => {
    activeCourseId = DEFAULT_COURSE_ID;
    snapshots.clear();
    hydratedCourses.clear();
    hydratingCourses.clear();
    listeners.clear();
  },
};
