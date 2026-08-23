import { Alert } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { createLogger } from '@/lib/log';
import { APP_VERSION, isServerConfigured } from '@/lib/serverConfig';

import {
  fetchBootstrapRaw,
  fetchCourseDocRaw,
  fetchLessonDocRaw,
  fetchModuleDocRaw,
} from './client';
import { planContentFetch, planProgressActions } from './planner';
import { clearPrompt, loadPrompt, savePrompt } from './promptStore';
import { isVersionBelow } from './semver';
import { courseStore } from './store';
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
  | 'app-update-required';
export type UpdateResult = {
  status: UpdateStatus;
  app?: BootstrapResponseV2['app'];
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
const moduleDocFromBundle = (
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

const runContentPhase = async (
  bootstrap: BootstrapResponseV2,
  localVersion: string,
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
  const bundle = courseStore.getSnapshot().bundle;
  const lessonOwner = new Map(
    bundle.modules.flatMap(module =>
      module.lessons.map(
        lesson => [lesson.lessonId, module.moduleId] as [string, string],
      ),
    ),
  );
  const plan =
    bootstrap.course.mode === 'full'
      ? { full: true, moduleIds: [], lessonIds: [] }
      : planContentFetch(
          entriesAbove(bootstrap.course.pendingVersions, localVersion).flatMap(
            entry => entry.instructions,
          ),
          lessonOwner,
        );
  log.info(`content phase ${localVersion} → ${latest}`, {
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
    const body = await fetchModuleDocRaw(
      courseStore.activeCourseId(),
      latest,
      moduleId,
    );
    const doc = verified(
      verifyModuleDocBody(body, ref, latest),
      `module ${moduleId}`,
    );
    tick();
    return doc;
  };

  onProgress?.({ fetched, total });
  const courseBody = await fetchCourseDocRaw(
    courseStore.activeCourseId(),
    latest,
  );
  const courseDoc = verified(
    verifyCourseDocBody(courseBody, documents.course, latest),
    'course doc',
  );
  tick();

  const targetModuleIds = courseDoc.course.moduleIds;
  const knownModules = new Set(bundle.modules.map(module => module.moduleId));
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
    const body = await fetchLessonDocRaw(
      courseStore.activeCourseId(),
      latest,
      lessonId,
    );
    const doc = verified(
      verifyLessonDocBody(body, ref, latest),
      `lesson ${lessonId}`,
    );
    tick();
    return doc;
  });

  const docs = new Map<string, ModuleDocV2>();
  if (!plan.full) {
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
  deps: UpdaterDeps,
  bootstrap: BootstrapResponseV2,
  seenVersion: string,
): Promise<void> => {
  const latest = bootstrap.course.latestVersion;
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
    courseStore.getSnapshot().bundle,
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
    const contentVersion = courseStore.getSnapshot().deliveryVersion;
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
      contentVersion,
      seenVersion,
      askingServerFrom: floor,
      appVersion: APP_VERSION,
    });

    let bootstrapBody: string;
    try {
      bootstrapBody = await fetchBootstrapRaw(
        courseStore.activeCourseId(),
        floor,
        APP_VERSION,
      );
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

    // Compatibility gate — before any content fetch or commit. An app that is
    // below the server's floor, cannot speak the target schema, or does not
    // satisfy the target version's own minAppVersion must not download.
    const targetEntry = bootstrap.course.pendingVersions.find(
      entry => entry.version === latest,
    );
    const incompatible =
      isVersionBelow(APP_VERSION, app.minSupportedAppVersion) ||
      bootstrap.course.schemaVersion > COURSE_SCHEMA_VERSION ||
      (targetEntry != null &&
        isVersionBelow(APP_VERSION, targetEntry.minAppVersion));
    if (incompatible) {
      log.warn(
        `app ${APP_VERSION} cannot take course ${latest} (min app ${app.minSupportedAppVersion}, schema ${bootstrap.course.schemaVersion}) — update required`,
      );
      return { status: 'app-update-required', app };
    }

    try {
      let updated = false;
      if (isVersionBelow(contentVersion, latest)) {
        await runContentPhase(bootstrap, contentVersion, deps.onProgress);
        updated = true;
      } else {
        log.info(`content already at ${contentVersion} — nothing to download`);
      }
      if (isVersionBelow(seenVersion, latest)) {
        await runProgressPhase(deps, bootstrap, seenVersion);
        updated = true;
      }
      const status = updated ? 'updated' : 'up-to-date';
      log.info(`done: ${status} (${elapsed()}ms)`);
      return { status, app };
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
