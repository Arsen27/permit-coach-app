import { Alert } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { createLogger } from '@/lib/log';
import { APP_VERSION, isServerConfigured } from '@/lib/serverConfig';
import { sha256Hex, utf8ByteLength } from '@/lib/sha256';

import {
  fetchBootstrapRaw,
  fetchCourseDocRaw,
  fetchLessonDocRaw,
  fetchModuleDocRaw,
} from './client';
import type { CourseId } from './index';
import { planContentFetch, planProgressActions } from './planner';
import { clearPrompt, loadPrompt, savePrompt } from './promptStore';
import { isVersionBelow } from './semver';
import { StoredCourse, courseStore } from './store';
import {
  verifyCourseDocBody,
  verifyLessonDocBody,
  verifyModuleDocBody,
} from './v2/verify';
import type {
  BootstrapResponseV2,
  CourseBundleV2,
  LessonDocV2,
  ManifestVersionV2,
  ModuleDocV2,
  UpdateInstructionV2,
} from './v2/wire';
import {
  COURSE_SCHEMA_VERSION,
  validateBootstrapResponseV2,
  validateModuleDocV2,
} from './v2/wire';

// Orchestrates one update pass: bootstrap → compatibility gate → verified
// fetch plan → commit content → severity pass over progress → persist the
// aggregated prompt. Content commit (device-global, cursor = the store's
// deliveryVersion) and the progress pass (per-user, cursor = course-seen) are
// deliberately separate so a kill in between resumes cleanly and each account
// gets its own severity pass.
//
// installCourse at the bottom is the other entry point: the first download
// of a course the device does not have (onboarding, a state switch, or the
// recovery gate). Same fetch-and-verify pipeline, always the full course.

const seenKey = (userId: string) => `dmv-prep/course-seen/v2/${userId}`;

const log = createLogger('course');

// Instructions are the payload that drives both what to download and what
// happens to progress — worth seeing verbatim while testing.
const describeInstructions = (instructions: UpdateInstructionV2[]): string[] =>
  instructions.map(instruction => {
    const lesson =
      'lessonId' in instruction && instruction.lessonId != null
        ? ` lesson=${instruction.lessonId}`
        : '';
    const module =
      'moduleId' in instruction && instruction.moduleId != null
        ? ` module=${instruction.moduleId}`
        : '';
    const question =
      'questionId' in instruction ? ` question=${instruction.questionId}` : '';
    return `${instruction.op}${lesson}${module}${question} [${instruction.severity}]`;
  });

export type UpdateProgress = { fetched: number; total: number };
export type UpdateStatus =
  | 'up-to-date'
  | 'updated'
  | 'offline'
  | 'failed'
  | 'app-update-required'
  // The device holds no version of the active course: there is nothing to
  // update, and the first download belongs to installCourse.
  | 'no-course';
// A fundamentally new course waiting for the learner's consent: `version` is
// what accepting downloads (the latest), `notes` are the release notes of the
// opt-in boundary itself — the words that explain why the new course exists.
export type CourseOffer = { version: string; notes?: string };
export type UpdateResult = {
  status: UpdateStatus;
  app?: BootstrapResponseV2['app'];
  offer?: CourseOffer;
};

export type UpdaterDeps = {
  userId: string;
  getProgress: () => { lessonIds: string[]; topicIds: string[] };
  resetLessons: (lessonIds: string[]) => void;
  resetTopics: (topicIds: string[]) => void;
  onProgress?: (progress: UpdateProgress) => void;
};

const entriesAbove = (
  entries: ManifestVersionV2[],
  version: string,
): ManifestVersionV2[] =>
  entries.filter(entry => isVersionBelow(version, entry.version));

// Absent or 'auto' downloads on the next check. Anything else is opt-in —
// including adoption values from a future manifest schema this build does not
// know: never auto-download what we do not understand.
const isOptIn = (entry: ManifestVersionV2): boolean =>
  entry.adoption != null && entry.adoption !== 'auto';

// Splits the pending versions at the first opt-in entry: everything below it
// still flows automatically; the boundary and everything above only move with
// the learner's explicit consent (acceptCourseOffer).
const splitAtOptIn = (
  pending: ManifestVersionV2[],
): { auto: ManifestVersionV2[]; boundary: ManifestVersionV2 | null } => {
  const index = pending.findIndex(isOptIn);
  return index === -1
    ? { auto: pending, boundary: null }
    : { auto: pending.slice(0, index), boundary: pending[index] };
};

const mapLimit = async <T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await task(items[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
};

const dedupeBy = <T>(items: T[], key: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter(item => {
    const id = key(item);
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
};

// Rebuilds a ModuleDocV2 for a module the update did not touch, from the
// bundle currently in memory, restamped with the new delivery version.
// The exact form every document hash is taken over — the importer and the
// admin serialise releases the same way, so a document rebuilt here can be
// compared with the manifest byte for byte.
const serializeDoc = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;

export const moduleDocFromBundle = (
  bundle: CourseBundleV2,
  moduleId: string,
  deliveryVersion: string,
): ModuleDocV2 | null => {
  const module = bundle.modules.find(entry => entry.moduleId === moduleId);
  if (module == null) {
    return null;
  }
  const questionById = new Map(
    bundle.questions.map(question => [question.questionId, question]),
  );
  const assetById = new Map(bundle.assets.map(asset => [asset.assetId, asset]));
  const questionRefs = [
    ...module.lessons.flatMap(lesson => lesson.questionIds),
    ...module.moduleTest.questionIds,
  ];
  const questions = dedupeBy(
    questionRefs.flatMap(id => {
      const question = questionById.get(id);
      return question != null ? [question] : [];
    }),
    question => question.questionId,
  );
  const assetRefs = [
    ...module.lessons.flatMap(lesson => lesson.assetIds),
    ...questions.flatMap(question =>
      question.assetId != null ? [question.assetId] : [],
    ),
  ];
  const assets = dedupeBy(
    assetRefs.flatMap(id => {
      const asset = assetById.get(id);
      return asset != null ? [asset] : [];
    }),
    asset => asset.assetId,
  );
  return {
    schemaVersion: COURSE_SCHEMA_VERSION,
    deliveryVersion,
    module,
    questions,
    assets,
  };
};

// Splices a fetched lesson doc (lesson body + its questions + its assets)
// into the owning module doc: replaces the lesson, rebuilds the canonical
// question/asset lists in membership order, and drops entries no longer
// referenced. Dangling references are an error — the caller aborts the
// whole content phase.
export const foldLessonIntoModule = (
  target: ModuleDocV2,
  lessonDoc: LessonDocV2,
): ModuleDocV2 => {
  const lessonId = lessonDoc.lesson.lessonId;
  const lessons = target.module.lessons.some(
    lesson => lesson.lessonId === lessonId,
  )
    ? target.module.lessons.map(lesson =>
        lesson.lessonId === lessonId ? lessonDoc.lesson : lesson,
      )
    : [...target.module.lessons, lessonDoc.lesson];

  const questionById = new Map(
    target.questions.map(question => [question.questionId, question]),
  );
  lessonDoc.questions.forEach(question =>
    questionById.set(question.questionId, question),
  );
  const questionRefs = [
    ...lessons.flatMap(lesson => lesson.questionIds),
    ...target.module.moduleTest.questionIds,
  ];
  const questions = dedupeBy(
    questionRefs.map(id => {
      const question = questionById.get(id);
      if (question == null) {
        throw new Error(
          `dangling question reference ${id} after folding ${lessonId}`,
        );
      }
      return question;
    }),
    question => question.questionId,
  );

  const assetById = new Map(target.assets.map(asset => [asset.assetId, asset]));
  lessonDoc.assets.forEach(asset => assetById.set(asset.assetId, asset));
  const assetRefs = [
    ...lessons.flatMap(lesson => lesson.assetIds),
    ...questions.flatMap(question =>
      question.assetId != null ? [question.assetId] : [],
    ),
  ];
  const assets = dedupeBy(
    assetRefs.map(id => {
      const asset = assetById.get(id);
      if (asset == null) {
        throw new Error(
          `dangling asset reference ${id} after folding ${lessonId}`,
        );
      }
      return asset;
    }),
    asset => asset.assetId,
  );

  return {
    schemaVersion: COURSE_SCHEMA_VERSION,
    deliveryVersion: lessonDoc.deliveryVersion,
    module: { ...target.module, lessons },
    questions,
    assets,
  };
};

// Downloads and commits `latest` for `courseId`. `local` is what the device
// holds of that course — null for a first download, in which case the whole
// course is fetched regardless of what the bootstrap says: with nothing to
// diff against there is no such thing as a delta.
const runContentPhase = async (
  courseId: CourseId,
  bootstrap: BootstrapResponseV2,
  local: StoredCourse | null,
  onProgress?: (progress: UpdateProgress) => void,
): Promise<void> => {
  const latest = bootstrap.course.latestVersion;
  const targetEntry = bootstrap.course.pendingVersions.find(
    entry => entry.version === latest,
  );
  if (targetEntry == null) {
    throw new Error(`bootstrap carries no manifest entry for ${latest}`);
  }
  const documents = targetEntry.documents;
  const bundle = local?.bundle ?? null;
  const localVersion = local?.deliveryVersion ?? null;
  const lessonOwner = new Map(
    (bundle?.modules ?? []).flatMap(module =>
      module.lessons.map(
        lesson => [lesson.lessonId, module.moduleId] as [string, string],
      ),
    ),
  );
  const plan =
    bootstrap.course.mode === 'full' || bundle == null || localVersion == null
      ? { full: true, moduleIds: [], lessonIds: [] }
      : planContentFetch(
          entriesAbove(bootstrap.course.pendingVersions, localVersion).flatMap(
            entry => entry.instructions,
          ),
          lessonOwner,
        );
  log.info(`content phase ${courseId} ${localVersion ?? 'none'} → ${latest}`, {
    fetchPlan: plan.full
      ? 'full course'
      : { modules: plan.moduleIds, lessons: plan.lessonIds },
  });

  let fetched = 0;
  let total = 1;
  const tick = () => {
    fetched += 1;
    onProgress?.({ fetched, total });
  };

  const verified = <T>(
    result:
      | { ok: true; value: T; errors: [] }
      | { ok: false; value: null; errors: string[] },
    label: string,
  ): T => {
    if (!result.ok) {
      throw new Error(`${label} failed verification: ${result.errors[0]}`);
    }
    return result.value;
  };

  const fetchModule = async (moduleId: string): Promise<ModuleDocV2> => {
    const ref = documents.modules[moduleId];
    if (ref == null) {
      throw new Error(`manifest has no document ref for module ${moduleId}`);
    }
    const body = await fetchModuleDocRaw(courseId, latest, moduleId);
    const doc = verified(
      verifyModuleDocBody(body, ref, latest),
      `module ${moduleId}`,
    );
    tick();
    return doc;
  };

  onProgress?.({ fetched, total });
  const courseBody = await fetchCourseDocRaw(courseId, latest);
  const courseDoc = verified(
    verifyCourseDocBody(courseBody, documents.course, latest),
    'course doc',
  );
  tick();

  if (courseDoc.course.courseId !== courseId) {
    throw new Error(
      `course doc names ${courseDoc.course.courseId}, expected ${courseId}`,
    );
  }
  const targetModuleIds = courseDoc.course.moduleIds;
  const knownModules = new Set(
    (bundle?.modules ?? []).map(module => module.moduleId),
  );
  const moduleIdsToFetch = plan.full
    ? targetModuleIds
    : [
        ...new Set([
          ...plan.moduleIds,
          // Modules that exist in the new course but not on the device must
          // always come from the server.
          ...targetModuleIds.filter(id => !knownModules.has(id)),
        ]),
      ];
  total = 1 + moduleIdsToFetch.length + plan.lessonIds.length;
  onProgress?.({ fetched, total });

  const fetchedModuleDocs = await mapLimit(moduleIdsToFetch, 4, fetchModule);
  const lessonDocs = await mapLimit(plan.lessonIds, 4, async lessonId => {
    const ref = documents.lessons[lessonId];
    if (ref == null) {
      throw new Error(`manifest has no document ref for lesson ${lessonId}`);
    }
    const body = await fetchLessonDocRaw(courseId, latest, lessonId);
    const doc = verified(
      verifyLessonDocBody(body, ref, latest),
      `lesson ${lessonId}`,
    );
    tick();
    return doc;
  });

  const docs = new Map<string, ModuleDocV2>();
  if (!plan.full && bundle != null) {
    for (const id of targetModuleIds) {
      const carried = moduleDocFromBundle(bundle, id, latest);
      if (carried != null) {
        docs.set(id, carried);
      }
    }
  }
  fetchedModuleDocs.forEach(doc => docs.set(doc.module.moduleId, doc));
  for (const lessonDoc of lessonDocs) {
    log.info(
      `folding lesson ${lessonDoc.lesson.lessonId} into module ${lessonDoc.lesson.moduleId}`,
      {
        title: lessonDoc.lesson.title,
        questions: lessonDoc.questions.map(question => question.questionId),
        assets: lessonDoc.assets.map(asset => asset.assetId),
      },
    );
    const owner = lessonDoc.lesson.moduleId;
    const target = docs.get(owner);
    if (target == null) {
      // The lesson moved to a module the device has never seen.
      docs.set(owner, await fetchModule(owner));
    } else {
      docs.set(owner, foldLessonIntoModule(target, lessonDoc));
    }
  }

  // What was not downloaded was assembled here — carried forward whole, or
  // carried forward with a fetched lesson folded in — on the strength of the
  // instructions alone. The manifest says exactly what each document must
  // hash to, so the assembled bytes are checked against it rather than
  // trusted: an instruction that failed to mention a change would otherwise
  // leave the device on stale content while believing it was up to date.
  // Anything that disagrees is downloaded like everything else.
  const downloaded = new Set(moduleIdsToFetch);
  const mismatched = targetModuleIds.filter(id => {
    if (downloaded.has(id)) {
      return false;
    }
    const doc = docs.get(id);
    const ref = documents.modules[id];
    if (doc == null || ref == null) {
      return doc != null;
    }
    const body = serializeDoc(doc);
    return (
      sha256Hex(body) !== ref.sha256 || utf8ByteLength(body) !== ref.sizeBytes
    );
  });
  if (mismatched.length > 0) {
    log.warn(
      `assembled modules disagree with the manifest — downloading them: ${mismatched.join(
        ', ',
      )}`,
    );
    total += mismatched.length;
    onProgress?.({ fetched, total });
    for (const doc of await mapLimit(mismatched, 4, fetchModule)) {
      docs.set(doc.module.moduleId, doc);
    }
  }

  const ordered = targetModuleIds.flatMap(id => {
    const doc = docs.get(id);
    return doc != null ? [doc] : [];
  });
  if (ordered.length !== targetModuleIds.length) {
    throw new Error('incomplete module doc set for commit');
  }
  // Assembled docs (carried-forward and folded ones included) must pass the
  // same structural validation as freshly downloaded documents.
  for (const doc of ordered) {
    const check = validateModuleDocV2(doc, { deliveryVersion: latest });
    if (!check.ok) {
      throw new Error(
        `assembled module ${doc.module.moduleId} failed validation: ${check.errors[0]}`,
      );
    }
  }
  await courseStore.commit(latest, courseDoc, ordered);
};

const runProgressPhase = async (
  courseId: CourseId,
  deps: UpdaterDeps,
  bootstrap: BootstrapResponseV2,
  seenVersion: string,
): Promise<void> => {
  const latest = bootstrap.course.latestVersion;
  // The content phase committed this course just before (or an earlier run
  // did); the slot is read directly so a state switch mid-update cannot
  // hand the progress pass another course's bundle.
  const committed = courseStore.storedFor(courseId);
  if (committed == null) {
    throw new Error(`progress phase: no committed ${courseId} bundle`);
  }
  // mode 'full' means the server could not relate our version to the
  // manifest. The progress policy is whatever the server explicitly returned
  // as progressFallback — never inferred here.
  const instructions: UpdateInstructionV2[] =
    bootstrap.course.mode === 'full'
      ? [
          {
            op: 'full',
            severity: bootstrap.course.progressFallback!.severity,
            ...(bootstrap.course.progressFallback!.message !== undefined && {
              message: bootstrap.course.progressFallback!.message,
            }),
          },
        ]
      : entriesAbove(bootstrap.course.pendingVersions, seenVersion).flatMap(
          entry => entry.instructions,
        );
  const progress = deps.getProgress();
  log.info(`progress phase ${seenVersion} → ${latest}`, {
    startedLessons: progress.lessonIds.length,
    startedTopics: progress.topicIds.length,
    instructions: describeInstructions(instructions),
  });
  const plan = planProgressActions(
    deps.userId,
    instructions,
    progress,
    committed.bundle,
  );
  if (
    plan.hardResets.lessonIds.length > 0 ||
    plan.hardResets.topicIds.length > 0
  ) {
    log.warn('hard reset applied', plan.hardResets);
  }
  deps.resetLessons(plan.hardResets.lessonIds);
  deps.resetTopics(plan.hardResets.topicIds);
  if (plan.prompt != null) {
    log.info(`prompt queued (${plan.prompt.kind})`, {
      message: plan.prompt.message,
      optionalReset: plan.prompt.optionalReset,
    });
    await savePrompt(plan.prompt);
  } else {
    log.info('no prompt: nothing affected was started');
  }
  await AsyncStorage.setItem(seenKey(deps.userId), latest);
  log.info(`seen cursor → ${latest} (user ${deps.userId})`);
};

let running: Promise<UpdateResult> | null = null;

export const runCourseUpdate = (deps: UpdaterDeps): Promise<UpdateResult> => {
  if (running != null) {
    return running;
  }
  running = (async (): Promise<UpdateResult> => {
    if (!isServerConfigured) {
      log.info('skipped: SERVER_URL is empty (running on the bundled seed)');
      return { status: 'up-to-date' };
    }
    const elapsed = log.time();
    await courseStore.hydrate();
    const courseId = courseStore.activeCourseId();
    const stored = courseStore.getSnapshot();
    if (stored == null) {
      log.info(
        `no ${courseId} course on this device — nothing to update (the first download belongs to installCourse)`,
      );
      return { status: 'no-course' };
    }
    const contentVersion = stored.deliveryVersion;
    let seenVersion = await AsyncStorage.getItem(seenKey(deps.userId));
    if (seenVersion == null) {
      seenVersion = contentVersion;
      await AsyncStorage.setItem(seenKey(deps.userId), seenVersion);
      log.info(
        `seen cursor initialized to ${seenVersion} (user ${deps.userId})`,
      );
    }

    const floor = isVersionBelow(seenVersion, contentVersion)
      ? seenVersion
      : contentVersion;
    log.info('check start', {
      user: deps.userId,
      course: courseId,
      contentVersion,
      seenVersion,
      askingServerFrom: floor,
      appVersion: APP_VERSION,
    });

    let bootstrapBody: string;
    try {
      bootstrapBody = await fetchBootstrapRaw(courseId, floor, APP_VERSION);
    } catch {
      log.warn(
        `offline: bootstrap unreachable (${elapsed()}ms) — retrying later`,
      );
      return { status: 'offline' };
    }

    let bootstrap: BootstrapResponseV2;
    try {
      const check = validateBootstrapResponseV2(JSON.parse(bootstrapBody));
      if (!check.ok) {
        throw new Error(check.errors[0]);
      }
      bootstrap = check.value;
    } catch (error) {
      log.error(
        'bootstrap payload failed validation — nothing fetched',
        error instanceof Error ? error.message : error,
      );
      return { status: 'failed' };
    }
    const app = bootstrap.app;
    const latest = bootstrap.course.latestVersion;
    log.info(
      `bootstrap: mode=${bootstrap.course.mode} latest=${latest} pending=${bootstrap.course.pendingVersions.length}`,
      bootstrap,
    );

    // Hard floor first: an app below the server's minimum or unable to speak
    // the schema must not download anything at all.
    if (
      isVersionBelow(APP_VERSION, app.minSupportedAppVersion) ||
      bootstrap.course.schemaVersion > COURSE_SCHEMA_VERSION
    ) {
      log.warn(
        `app ${APP_VERSION} cannot take course ${latest} (min app ${app.minSupportedAppVersion}, schema ${bootstrap.course.schemaVersion}) — update required`,
      );
      return { status: 'app-update-required', app };
    }

    // Automatic updates stop below the first opt-in version: a fundamentally
    // new course is offered, never imposed. Fresh installs (mode 'full') have
    // nothing to lose and simply take the latest.
    const { auto, boundary } =
      bootstrap.course.mode === 'full'
        ? { auto: bootstrap.course.pendingVersions, boundary: null }
        : splitAtOptIn(
            entriesAbove(bootstrap.course.pendingVersions, contentVersion),
          );
    const autoTarget = auto.at(-1) ?? null;
    const autoLatest = autoTarget?.version ?? contentVersion;
    // The auto stretch is gated on its own target, not on the offer's: an app
    // too old for the new course can still take patches to its current one.
    if (
      autoTarget != null &&
      isVersionBelow(APP_VERSION, autoTarget.minAppVersion)
    ) {
      log.warn(
        `app ${APP_VERSION} is below ${autoLatest}'s minAppVersion ${autoTarget.minAppVersion} — update required`,
      );
      return { status: 'app-update-required', app };
    }
    const latestEntry = bootstrap.course.pendingVersions.find(
      entry => entry.version === latest,
    );
    const offer: CourseOffer | undefined =
      boundary != null &&
      latestEntry != null &&
      !isVersionBelow(APP_VERSION, latestEntry.minAppVersion)
        ? {
            version: latest,
            ...(boundary.notes !== undefined && { notes: boundary.notes }),
          }
        : undefined;
    if (boundary != null && offer == null) {
      log.info(
        `opt-in course ${latest} needs app ${latestEntry?.minAppVersion} — offer withheld`,
      );
    }
    // What the automatic pass is allowed to see: the bootstrap cropped at the
    // opt-in boundary, so the existing phases need no new plumbing.
    const autoBootstrap: BootstrapResponseV2 =
      boundary == null
        ? bootstrap
        : {
            ...bootstrap,
            course: {
              ...bootstrap.course,
              latestVersion: autoLatest,
              pendingVersions: auto,
            },
          };

    try {
      let updated = false;
      // mode 'full' means the server cannot place our version in the manifest
      // at all — it was withdrawn after a bad release, or never published. The
      // content is replaced wholesale there, so version ordering carries no
      // information: a withdrawn release has to be able to move us back down.
      // Comparing versions instead would strand every device that took it.
      const replaceWholesale = bootstrap.course.mode === 'full';
      if (replaceWholesale || isVersionBelow(contentVersion, autoLatest)) {
        await runContentPhase(courseId, autoBootstrap, stored, deps.onProgress);
        updated = true;
      } else {
        log.info(`content already at ${contentVersion} — nothing to download`);
      }
      if (replaceWholesale || isVersionBelow(seenVersion, autoLatest)) {
        await runProgressPhase(courseId, deps, autoBootstrap, seenVersion);
        updated = true;
      }
      const status = updated ? 'updated' : 'up-to-date';
      log.info(
        `done: ${status} (${elapsed()}ms)${
          offer != null ? ` — offering ${offer.version}` : ''
        }`,
      );
      return { status, app, ...(offer != null && { offer }) };
    } catch (error) {
      // Nothing was committed on a failed content phase; the next run
      // recomputes from the unchanged cursors.
      log.error(
        `failed after ${elapsed()}ms — nothing committed, cursors unchanged`,
        error instanceof Error ? error.message : error,
      );
      return { status: 'failed', app };
    }
  })().finally(() => {
    running = null;
  });
  return running;
};

// The learner said yes to a fundamentally new course: download it all the way
// to the latest version and start their course progress over. The wipe is the
// deal they accepted — it replaces the per-instruction progress phase, so no
// prompt is queued. Progress on practice topics, saved items and the streak
// is not course content and stays.
export const acceptCourseOffer = (deps: UpdaterDeps): Promise<UpdateResult> => {
  if (running != null) {
    return running;
  }
  running = (async (): Promise<UpdateResult> => {
    if (!isServerConfigured) {
      return { status: 'up-to-date' };
    }
    const elapsed = log.time();
    await courseStore.hydrate();
    const courseId = courseStore.activeCourseId();
    const stored = courseStore.getSnapshot();
    if (stored == null) {
      // An offer is only ever made against a course on the device.
      return { status: 'no-course' };
    }
    const contentVersion = stored.deliveryVersion;

    let bootstrapBody: string;
    try {
      bootstrapBody = await fetchBootstrapRaw(
        courseId,
        contentVersion,
        APP_VERSION,
      );
    } catch {
      log.warn(`offer accept: bootstrap unreachable (${elapsed()}ms)`);
      return { status: 'offline' };
    }
    let bootstrap: BootstrapResponseV2;
    try {
      const check = validateBootstrapResponseV2(JSON.parse(bootstrapBody));
      if (!check.ok) {
        throw new Error(check.errors[0]);
      }
      bootstrap = check.value;
    } catch (error) {
      log.error(
        'offer accept: bootstrap payload failed validation',
        error instanceof Error ? error.message : error,
      );
      return { status: 'failed' };
    }
    const app = bootstrap.app;
    const latest = bootstrap.course.latestVersion;
    const latestEntry = bootstrap.course.pendingVersions.find(
      entry => entry.version === latest,
    );
    if (
      isVersionBelow(APP_VERSION, app.minSupportedAppVersion) ||
      bootstrap.course.schemaVersion > COURSE_SCHEMA_VERSION ||
      (latestEntry != null &&
        isVersionBelow(APP_VERSION, latestEntry.minAppVersion))
    ) {
      log.warn(`offer accept: app ${APP_VERSION} cannot take ${latest}`);
      return { status: 'app-update-required', app };
    }
    if (!isVersionBelow(contentVersion, latest)) {
      log.info(`offer accept: already at ${contentVersion}`);
      return { status: 'up-to-date', app };
    }

    // The scope to wipe is whatever the OLD course tracked — captured before
    // the commit swaps the bundle out from under us.
    const oldBundle = stored.bundle;
    const oldLessonIds = oldBundle.modules.flatMap(module =>
      module.lessons.map(lesson => lesson.lessonId),
    );
    const oldModuleIds = oldBundle.modules.map(module => module.moduleId);

    try {
      await runContentPhase(courseId, bootstrap, stored, deps.onProgress);
      deps.resetLessons(oldLessonIds);
      deps.resetTopics(oldModuleIds);
      await AsyncStorage.setItem(seenKey(deps.userId), latest);
      log.info(
        `offer accepted: ${contentVersion} → ${latest} with a fresh start (${elapsed()}ms)`,
        { wipedLessons: oldLessonIds.length, wipedTopics: oldModuleIds.length },
      );
      return { status: 'updated', app };
    } catch (error) {
      // Nothing committed, nothing wiped — the offer stands and can be
      // accepted again.
      log.error(
        `offer accept failed after ${elapsed()}ms — nothing committed`,
        error instanceof Error ? error.message : error,
      );
      return { status: 'failed', app };
    }
  })().finally(() => {
    running = null;
  });
  return running;
};

export type InstallStatus =
  | 'installed'
  | 'offline'
  | 'failed'
  | 'app-update-required';
export type InstallResult = {
  status: InstallStatus;
  app?: BootstrapResponseV2['app'];
};

export type InstallDeps = {
  courseId: CourseId;
  onProgress?: (progress: UpdateProgress) => void;
};

const installing = new Map<CourseId, Promise<InstallResult>>();

// The first download of a course the device does not have: the learner's
// state course during onboarding, a newly chosen state in Settings, or the
// recovery path for an onboarded device whose store came up empty. Always the
// full course at the server's latest release — with nothing local there is
// nothing to diff against — committed into that course's own slot, so a
// download ahead of a state switch never disturbs the course in use.
//
// Progress and the per-user seen cursor are left alone on purpose: a new
// course has no progress to reconcile, and a re-download after store loss
// lets the next regular update pass pick up from whatever cursor it finds.
export const installCourse = (deps: InstallDeps): Promise<InstallResult> => {
  const { courseId } = deps;
  const inFlight = installing.get(courseId);
  if (inFlight != null) {
    return inFlight;
  }
  const run = (async (): Promise<InstallResult> => {
    if (!isServerConfigured) {
      log.error(
        `install ${courseId} impossible: SERVER_URL is empty — the app ships no course`,
      );
      return { status: 'failed' };
    }
    const elapsed = log.time();
    log.info(`install start ${courseId}`, { appVersion: APP_VERSION });

    let bootstrapBody: string;
    try {
      bootstrapBody = await fetchBootstrapRaw(courseId, null, APP_VERSION);
    } catch {
      log.warn(`install ${courseId}: offline (${elapsed()}ms)`);
      return { status: 'offline' };
    }

    let bootstrap: BootstrapResponseV2;
    try {
      const check = validateBootstrapResponseV2(JSON.parse(bootstrapBody));
      if (!check.ok) {
        throw new Error(check.errors[0]);
      }
      bootstrap = check.value;
    } catch (error) {
      log.error(
        `install ${courseId}: bootstrap payload failed validation`,
        error instanceof Error ? error.message : error,
      );
      return { status: 'failed' };
    }
    const app = bootstrap.app;
    const latest = bootstrap.course.latestVersion;
    const latestEntry = bootstrap.course.pendingVersions.find(
      entry => entry.version === latest,
    );
    if (
      isVersionBelow(APP_VERSION, app.minSupportedAppVersion) ||
      bootstrap.course.schemaVersion > COURSE_SCHEMA_VERSION ||
      (latestEntry != null &&
        isVersionBelow(APP_VERSION, latestEntry.minAppVersion))
    ) {
      log.warn(
        `install ${courseId}: app ${APP_VERSION} cannot take ${latest} — update required`,
      );
      return { status: 'app-update-required', app };
    }

    try {
      await runContentPhase(courseId, bootstrap, null, deps.onProgress);
      log.info(`installed ${courseId}@${latest} (${elapsed()}ms)`);
      return { status: 'installed', app };
    } catch (error) {
      // Nothing was committed: the store slot is exactly as empty as before.
      log.error(
        `install ${courseId} failed after ${elapsed()}ms — nothing committed`,
        error instanceof Error ? error.message : error,
      );
      return { status: 'failed', app };
    }
  })().finally(() => {
    installing.delete(courseId);
  });
  installing.set(courseId, run);
  return run;
};

// Shows the persisted aggregated prompt (at most one per user), if any.
export const drainPrompt = async (
  userId: string,
  resetLessons: (lessonIds: string[]) => void,
  resetTopics: (topicIds: string[]) => void,
): Promise<void> => {
  const prompt = await loadPrompt(userId);
  if (prompt == null) {
    return;
  }
  log.info(`showing ${prompt.kind} prompt`, prompt);
  if (prompt.kind === 'hard') {
    Alert.alert('Course updated', prompt.message, [
      { text: 'OK', onPress: () => clearPrompt(userId) },
    ]);
    return;
  }
  Alert.alert('Course updated', prompt.message, [
    {
      text: 'Keep my progress',
      style: 'cancel',
      onPress: () => clearPrompt(userId),
    },
    {
      text: 'Redo',
      style: 'destructive',
      onPress: () => {
        log.warn(
          'user chose Redo — optional reset applied',
          prompt.optionalReset,
        );
        resetLessons(prompt.optionalReset.lessonIds);
        resetTopics(prompt.optionalReset.topicIds);
        clearPrompt(userId);
      },
    },
  ]);
};
