import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ensureAssets,
  setAssetsBaseUrl,
  warmAssets,
} from '@/data/assets/store';
import { BankQuestionV1, validateQuestionBankDoc } from '@/data/bank/wire';
import { hydrateContentChannel } from '@/lib/contentChannel';
import { createLogger } from '@/lib/log';
import { APP_VERSION, isServerConfigured } from '@/lib/serverConfig';
import { sha256Hex } from '@/lib/sha256';

import {
  fetchBankDocRaw,
  fetchLessonDocRaw,
  fetchOutlineRaw,
  fetchVerdictRaw,
} from './client';
import type { CourseId } from './index';
import { CourseOutlineV1, validateCourseOutline } from './outlineWire';
import { verifyLessonDocBody } from './v2/verify';
import type {
  CourseBundleV2,
  CourseLessonV2,
  CourseModuleV2,
  CourseQuestionV2,
  LessonDocV2,
} from './v2/wire';

// The lazy course store. The device holds three things, each cached under
// what identifies it: the outline (structure — every lesson's name,
// description, question ids and document hash), the question bank (one
// document, updated wholesale), and lesson bodies, one per visited lesson,
// keyed by their own hash. A course works as a course from the outline and
// the bank alone — the ladder, the tests, the exam; only a lesson's slides
// wait for its body, downloaded when the lesson is opened and kept forever.
//
// No offline promise is made: an unvisited lesson needs the network once.
// Everything ever downloaded stays, so nothing is fetched twice.

const log = createLogger('course');

const PREFIX = 'dmv-prep/lazy/v1';
const outlineKey = (courseId: string) => `${PREFIX}/outline/${courseId}`;
const bankKey = (courseId: string) => `${PREFIX}/bank/${courseId}`;
const lessonKey = (courseId: string, sha256: string) =>
  `${PREFIX}/lesson/${courseId}/${sha256}`;
const marksKey = (userId: string, courseId: string) =>
  `${PREFIX}/marks/${userId}/${courseId}`;
const promptKey = (userId: string) => `${PREFIX}/prompt/${userId}`;

// One yellow mark: a lesson to re-take. Until the new body arrives it keeps
// the old blocks' hashes; the moment the body is downloaded the mark reduces
// to exactly the blocks that changed, so the player can tint those and no
// others. No hashes and no blocks means "treat the whole lesson as changed".
export type YellowMark = {
  blocks?: string[];
  oldBlockHashes?: Record<string, string>;
};

export type YellowMarks = Record<string, YellowMark>;

// Which lessons a learner should re-take, and why. Kept per user: the yellow
// is about *their* completion, not about the device.
export type ReplacePrompt = {
  kind: 'apology' | 'rules';
  message: string;
  lessonIds: string[];
};

export type SyncStatus = 'ready' | 'offline' | 'failed' | 'app-update-required';

export type SyncResult = {
  status: SyncStatus;
  offer?: { version: string; message: string };
  prompt?: ReplacePrompt;
};

type CourseState = {
  outline: CourseOutlineV1 | null;
  bankSha: string | null;
  questions: CourseQuestionV2[];
  lessonDocs: Map<string, LessonDocV2>;
  bundle: CourseBundleV2 | null;
  // The object handed to React. Rebuilt only when the content changes:
  // useSyncExternalStore treats a fresh identity as a change, and a snapshot
  // born new on every read renders forever.
  snapshot: { deliveryVersion: string; bundle: CourseBundleV2 } | null;
  hydrated: boolean;
};

const states = new Map<string, CourseState>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

const stateOf = (courseId: string): CourseState => {
  let state = states.get(courseId);
  if (state == null) {
    state = {
      outline: null,
      bankSha: null,
      questions: [],
      lessonDocs: new Map(),
      bundle: null,
      snapshot: null,
      hydrated: false,
    };
    states.set(courseId, state);
  }
  return state;
};

// A lesson the device has not opened yet, shaped the way every screen already
// reads: real metadata and question ids, empty slides.
const stubLesson = (
  outline: CourseOutlineV1,
  moduleId: string,
  lesson: CourseOutlineV1['modules'][number]['lessons'][number],
  globalSequence: number,
  moduleSequence: number,
): CourseLessonV2 => ({
  lessonId: lesson.lessonId,
  uuid: lesson.lessonId,
  moduleId,
  globalSequence,
  moduleSequence,
  title: lesson.title,
  objective: lesson.objective,
  estimatedMinutes: lesson.estimatedMinutes,
  format: 'scenario_first_cards',
  blocks: [],
  questionIds: lesson.questionIds,
  ...(lesson.theoryQuestionIds != null && {
    theoryQuestionIds: lesson.theoryQuestionIds,
  }),
  ...(lesson.testQuestionIds != null && {
    testQuestionIds: lesson.testQuestionIds,
  }),
  assetIds: [],
  language: 'en-US',
});

const assemble = (state: CourseState): void => {
  const outline = state.outline;
  if (outline == null) {
    state.bundle = null;
    state.snapshot = null;
    return;
  }
  let globalSequence = 0;
  const modules: CourseModuleV2[] = outline.modules.map(module => ({
    moduleId: module.moduleId,
    uuid: module.moduleId,
    sequence: module.sequence,
    title: module.title,
    outcome: '',
    lessons: module.lessons.map((lesson, index) => {
      globalSequence += 1;
      const loaded = state.lessonDocs.get(lesson.lessonId);
      return loaded != null
        ? loaded.lesson
        : stubLesson(
            outline,
            module.moduleId,
            lesson,
            globalSequence,
            index + 1,
          );
    }),
    moduleTest: {
      testId: `${module.moduleId}-test`,
      uuid: `${module.moduleId}-test`,
      moduleId: module.moduleId,
      questionIds: module.moduleTestQuestionIds,
    },
  }));
  const assets = new Map(
    [...state.lessonDocs.values()].flatMap(doc =>
      doc.assets.map(asset => [asset.assetId, asset] as const),
    ),
  );
  state.bundle = {
    course: {
      courseId: outline.courseId,
      title: outline.title,
      subtitle: '',
      jurisdiction: '',
      state: outline.state,
      language: 'en-US',
      targetLicense: '',
      moduleIds: modules.map(module => module.moduleId),
      sourceVersionLabel: '',
      sourceContentHash: '',
      sourceCheckedAt: '',
      sourceReviewStatus: '',
      publicationAuthorized: false,
    },
    modules,
    questions: state.questions,
    assets: [...assets.values()],
  } as CourseBundleV2;
  state.snapshot = {
    deliveryVersion: outline.version,
    bundle: state.bundle!,
  };
};

// The hash a lesson's cached body must carry, per the outline in force.
const lessonRefOf = (outline: CourseOutlineV1, lessonId: string) => {
  for (const module of outline.modules) {
    const lesson = module.lessons.find(item => item.lessonId === lessonId);
    if (lesson != null) {
      return lesson.doc;
    }
  }
  return null;
};

const rememberBank = (state: CourseState, body: string, sha: string): void => {
  const checked = validateQuestionBankDoc(JSON.parse(body));
  if (!checked.ok) {
    throw new Error(`bank failed validation: ${checked.errors[0]}`);
  }
  state.bankSha = sha;
  state.questions = checked.value.questions as unknown as CourseQuestionV2[];
};

const rememberLesson = (
  state: CourseState,
  lessonId: string,
  doc: LessonDocV2,
): void => {
  state.lessonDocs.set(lessonId, doc);
};

// Restores what the device holds for a course: the outline, the bank, and
// every lesson body the outline still points at.
export const hydrateLazyCourse = async (courseId: CourseId): Promise<void> => {
  const state = stateOf(courseId);
  if (state.hydrated) {
    return;
  }
  state.hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(outlineKey(courseId));
    if (raw != null) {
      const checked = validateCourseOutline(JSON.parse(raw));
      if (checked.ok) {
        state.outline = checked.value;
      }
    }
    const bankRaw = await AsyncStorage.getItem(bankKey(courseId));
    if (bankRaw != null) {
      const { sha, body } = JSON.parse(bankRaw) as {
        sha: string;
        body: string;
      };
      rememberBank(state, body, sha);
    }
    if (state.outline != null) {
      const wanted = state.outline.modules.flatMap(module =>
        module.lessons.map(lesson => ({
          lessonId: lesson.lessonId,
          sha256: lesson.doc.sha256,
        })),
      );
      const bodies = await AsyncStorage.getMany(
        wanted.map(item => lessonKey(courseId, item.sha256)),
      );
      for (const item of wanted) {
        const body = bodies[lessonKey(courseId, item.sha256)];
        if (body != null) {
          rememberLesson(state, item.lessonId, JSON.parse(body) as LessonDocV2);
        }
      }
    }
  } catch (error) {
    log.warn(`hydrate ${courseId} failed — starting empty`, error);
    state.outline = null;
    state.questions = [];
    state.lessonDocs.clear();
  }
  assemble(state);
  notify();
};

// One sync: the verdict, then whatever it says. Applies a replace wholesale
// (outline swapped, stale bodies dropped, yellow marks recorded), refreshes
// the bank when its hash moved, and hands back the offer if there is one.
export const syncLazyCourse = async (deps: {
  courseId: CourseId;
  userId: string;
  completedLessonIds: string[];
}): Promise<SyncResult> => {
  await hydrateContentChannel();
  if (!isServerConfigured) {
    return { status: 'ready' };
  }
  await hydrateLazyCourse(deps.courseId);
  const state = stateOf(deps.courseId);
  const held = state.outline?.version ?? null;

  let verdictRaw: string;
  try {
    verdictRaw = await fetchVerdictRaw(deps.courseId, held, APP_VERSION);
  } catch {
    return { status: 'offline' };
  }

  try {
    const verdict = JSON.parse(verdictRaw) as {
      app: { assetsBaseUrl: string; minSupportedAppVersion: string };
      course: {
        current: string;
        replace: {
          version: string;
          subtype: 'silent' | 'apology' | 'rules';
          changedLessons: string[] | null;
          message: string;
        } | null;
        offer: { version: string; message: string } | null;
        appUpdateRequired: boolean;
      };
      bank: { sha256: string } | null;
    };
    await setAssetsBaseUrl(verdict.app.assetsBaseUrl);

    const target =
      verdict.course.replace?.version ??
      (state.outline == null ? verdict.course.current : null);
    let prompt: ReplacePrompt | undefined;

    if (target != null && target !== held) {
      const outlineRaw = await fetchOutlineRaw(
        deps.courseId,
        target === verdict.course.current ? undefined : target,
      );
      const checked = validateCourseOutline(JSON.parse(outlineRaw));
      if (!checked.ok) {
        throw new Error(`outline failed validation: ${checked.errors[0]}`);
      }
      const next = checked.value;

      // Which lessons the learner should re-take: the changed ones they had
      // completed. Unknown changes mean every completed lesson.
      const replace = verdict.course.replace;
      if (replace != null && replace.subtype !== 'silent' && held != null) {
        const changed =
          replace.changedLessons ??
          next.modules.flatMap(module =>
            module.lessons.map(lesson => lesson.lessonId),
          );
        const completed = new Set(deps.completedLessonIds);
        const affected = changed.filter(lessonId => completed.has(lessonId));
        if (affected.length > 0) {
          prompt = {
            kind: replace.subtype,
            message: replace.message,
            lessonIds: affected,
          };
          const existing = await readMarks(deps.userId, deps.courseId);
          for (const lessonId of affected) {
            // The old body is still here for a beat: keep its blocks'
            // hashes, so the mark can narrow to the changed blocks the
            // moment the new body arrives.
            const old = state.lessonDocs.get(lessonId);
            existing[lessonId] =
              old == null
                ? {}
                : {
                    oldBlockHashes: Object.fromEntries(
                      old.lesson.blocks.map(block => [
                        block.blockId,
                        sha256Hex(JSON.stringify(block)),
                      ]),
                    ),
                  };
          }
          await writeMarks(deps.userId, deps.courseId, existing);
          await AsyncStorage.setItem(
            promptKey(deps.userId),
            JSON.stringify(prompt),
          );
        }
      }

      // The new outline takes over; bodies it no longer names go with the
      // version they belonged to. A body whose hash the new outline still
      // names is kept — nothing is fetched twice.
      const keep = new Set(
        next.modules.flatMap(module =>
          module.lessons.map(lesson =>
            lessonKey(deps.courseId, lesson.doc.sha256),
          ),
        ),
      );
      const stale = (await AsyncStorage.getAllKeys()).filter(
        key =>
          key.startsWith(`${PREFIX}/lesson/${deps.courseId}/`) &&
          !keep.has(key),
      );
      if (stale.length > 0) {
        await AsyncStorage.removeMany(stale);
      }
      await AsyncStorage.setItem(
        outlineKey(deps.courseId),
        JSON.stringify(next),
      );
      state.outline = next;
      for (const [lessonId, doc] of [...state.lessonDocs]) {
        const ref = lessonRefOf(next, lessonId);
        const body = `${JSON.stringify(doc, null, 2)}\n`;
        if (ref == null || sha256Hex(body) !== ref.sha256) {
          state.lessonDocs.delete(lessonId);
        }
      }
      log.info(
        `outline ${held ?? 'none'} → ${next.version} (${
          verdict.course.replace?.subtype ?? 'first'
        })`,
      );
    }

    // The bank moves by hash, wholesale, for everyone.
    if (verdict.bank != null && verdict.bank.sha256 !== state.bankSha) {
      const body = await fetchBankDocRaw(deps.courseId);
      const sha = sha256Hex(body);
      if (sha !== verdict.bank.sha256) {
        throw new Error('bank does not match its published hash');
      }
      rememberBank(state, body, sha);
      await AsyncStorage.setItem(
        bankKey(deps.courseId),
        JSON.stringify({ sha, body }),
      );
      log.info(
        `bank → ${sha.slice(0, 12)} (${state.questions.length} questions)`,
      );
    }

    assemble(state);
    notify();
    return {
      status: verdict.course.appUpdateRequired
        ? 'app-update-required'
        : 'ready',
      ...(verdict.course.offer != null && { offer: verdict.course.offer }),
      ...(prompt != null && { prompt }),
    };
  } catch (error) {
    log.error(
      'sync failed — the device keeps what it holds',
      error instanceof Error ? error.message : error,
    );
    return { status: 'failed' };
  }
};

// The learner said yes to a fundamentally new course: this course's cache is
// forgotten and the next sync takes the newest whole. The caller wipes the
// learner's progress — that is the deal the offer stated.
export const acceptOffer = async (deps: {
  courseId: CourseId;
  userId: string;
  completedLessonIds: string[];
}): Promise<SyncResult> => {
  const state = stateOf(deps.courseId);
  const keys = (await AsyncStorage.getAllKeys()).filter(
    key =>
      key.startsWith(`${PREFIX}/outline/${deps.courseId}`) ||
      key.startsWith(`${PREFIX}/bank/${deps.courseId}`) ||
      key.startsWith(`${PREFIX}/lesson/${deps.courseId}/`) ||
      key.startsWith(`${PREFIX}/marks/${deps.userId}/${deps.courseId}`),
  );
  if (keys.length > 0) {
    await AsyncStorage.removeMany(keys);
  }
  state.outline = null;
  state.bankSha = null;
  state.questions = [];
  state.lessonDocs.clear();
  assemble(state);
  notify();
  return syncLazyCourse(deps);
};

// Every picture this lesson draws, downloaded and read into memory as one
// batch when the lesson is opened — not card by card as the learner reaches
// them. A slide whose illustration is already in memory draws it in the same
// frame as its text; the alternative is a skeleton on every transition.
// Deliberately not awaited anywhere: the lesson opens on its text.
const prefetchLessonAssets = (doc: { assets: LessonDocV2['assets'] }): void => {
  if (doc.assets.length === 0) {
    return;
  }
  ensureAssets(doc.assets)
    .catch(() => undefined)
    // Even pictures already on the device cost a storage read each; doing
    // them together, up front, is what keeps the transitions quiet.
    .then(() => warmAssets(doc.assets.map(asset => asset.sha256)))
    .catch(() => undefined);
};

// The body of one lesson, fetched when the lesson is opened and kept forever
// under its own hash. Its pictures start downloading in the background at
// once, so the slides never wait on one.
export const ensureLesson = async (
  courseId: CourseId,
  lessonId: string,
): Promise<'ready' | 'offline' | 'failed'> => {
  const state = stateOf(courseId);
  const cached = state.lessonDocs.get(lessonId);
  if (cached != null) {
    // A lesson opened a second time still needs its pictures in memory: the
    // cache is small enough that another lesson's may have pushed them out.
    prefetchLessonAssets(cached);
    return 'ready';
  }
  const outline = state.outline;
  const ref = outline == null ? null : lessonRefOf(outline, lessonId);
  if (outline == null || ref == null) {
    return 'failed';
  }
  let body: string;
  try {
    body = await fetchLessonDocRaw(courseId, outline.version, lessonId);
  } catch {
    return 'offline';
  }
  const checked = verifyLessonDocBody(body, ref, outline.version);
  if (!checked.ok) {
    log.error(`lesson ${lessonId} failed verification: ${checked.errors[0]}`);
    return 'failed';
  }
  await AsyncStorage.setItem(lessonKey(courseId, ref.sha256), body);
  rememberLesson(state, lessonId, checked.value);
  assemble(state);
  notify();
  prefetchLessonAssets(checked.value);
  return 'ready';
};

// Whether the store has answered for this course yet: a null snapshot is
// only meaningful once it has.
export const lazyHydrated = (courseId: CourseId): boolean =>
  stateOf(courseId).hydrated;

// Forgets every downloaded course, bank, mark and prompt — the dev channel
// switch calls this; the caller re-syncs afterwards.
export const wipeLazy = async (): Promise<void> => {
  const keys = (await AsyncStorage.getAllKeys()).filter(key =>
    key.startsWith(`${PREFIX}/`),
  );
  if (keys.length > 0) {
    await AsyncStorage.removeMany(keys);
  }
  states.clear();
  notify();
};

export const lazySnapshot = (courseId: CourseId) => stateOf(courseId).snapshot;

export const lessonLoaded = (courseId: CourseId, lessonId: string): boolean =>
  stateOf(courseId).lessonDocs.has(lessonId);

export const subscribeLazy = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// ---------------------------------------------------------------------------
// Yellow marks: which lessons this learner should re-take. Cleared one by
// one as they complete each again.

// In memory too, so a screen can read the marks synchronously and re-render
// the moment they change.
const marksCache = new Map<string, YellowMarks>();

const writeMarks = async (
  userId: string,
  courseId: string,
  marks: YellowMarks,
): Promise<void> => {
  marksCache.set(`${userId}/${courseId}`, marks);
  await AsyncStorage.setItem(marksKey(userId, courseId), JSON.stringify(marks));
  notify();
};

export const readMarks = async (
  userId: string,
  courseId: string,
): Promise<YellowMarks> => {
  const cached = marksCache.get(`${userId}/${courseId}`);
  if (cached != null) {
    return cached;
  }
  try {
    const raw = await AsyncStorage.getItem(marksKey(userId, courseId));
    const marks = raw == null ? {} : (JSON.parse(raw) as YellowMarks);
    marksCache.set(`${userId}/${courseId}`, marks);
    notify();
    return marks;
  } catch {
    return {};
  }
};

// What a screen reads every render. Pure and identity-stable: a snapshot
// born new on every call renders forever, and one that starts disk reads is
// a side effect in a getter. The hook kicks the read; this only answers.
const EMPTY_MARKS: YellowMarks = {};

export const marksSnapshot = (userId: string, courseId: string): YellowMarks =>
  marksCache.get(`${userId}/${courseId}`) ?? EMPTY_MARKS;

export const clearMark = async (
  userId: string,
  courseId: string,
  lessonId: string,
): Promise<void> => {
  const marks = { ...(await readMarks(userId, courseId)) };
  if (marks[lessonId] != null) {
    delete marks[lessonId];
    await writeMarks(userId, courseId, marks);
  }
};

// When a marked lesson's new body lands, the mark narrows to the blocks that
// actually differ from the ones the learner saw.
export const narrowMark = async (
  userId: string,
  courseId: string,
  lessonId: string,
): Promise<void> => {
  const doc = stateOf(courseId).lessonDocs.get(lessonId);
  const marks = await readMarks(userId, courseId);
  const mark = marks[lessonId];
  if (doc == null || mark?.oldBlockHashes == null) {
    return;
  }
  const blocks = doc.lesson.blocks
    .filter(
      block =>
        mark.oldBlockHashes![block.blockId] !==
        sha256Hex(JSON.stringify(block)),
    )
    .map(block => block.blockId);
  await writeMarks(userId, courseId, {
    ...marks,
    [lessonId]: { blocks },
  });
};

// The persisted prompt, shown once and cleared — a kill while the modal was
// on screen re-shows it on the next launch.
export const takePrompt = async (
  userId: string,
): Promise<ReplacePrompt | null> => {
  try {
    const raw = await AsyncStorage.getItem(promptKey(userId));
    if (raw == null) {
      return null;
    }
    return JSON.parse(raw) as ReplacePrompt;
  } catch {
    return null;
  }
};

export const clearPromptFor = async (userId: string): Promise<void> => {
  await AsyncStorage.removeItem(promptKey(userId)).catch(() => undefined);
};

// Test seam: a course on the device without a server — the outline, the
// bank and every lesson body derived from the same documents the old
// fixtures built.
export const primeLazyCourseForTests = (
  courseId: CourseId,
  courseTitle: string,
  moduleDocs: {
    module: CourseModuleV2;
    questions: CourseQuestionV2[];
    assets: LessonDocV2['assets'];
  }[],
  version = '1.0.0',
  stateName = 'California',
): void => {
  const state = stateOf(courseId);
  state.hydrated = true;
  state.outline = {
    courseId,
    version,
    title: courseTitle,
    state: stateName,
    modules: moduleDocs.map((doc, index) => ({
      moduleId: doc.module.moduleId,
      title: doc.module.title,
      sequence: index + 1,
      moduleTestQuestionCount: doc.module.moduleTest.questionIds.length,
      moduleTestQuestionIds: doc.module.moduleTest.questionIds,
      lessons: doc.module.lessons.map(lesson => ({
        lessonId: lesson.lessonId,
        title: lesson.title,
        objective: lesson.objective,
        estimatedMinutes: lesson.estimatedMinutes,
        cardCount: 0,
        questionCount: lesson.questionIds.length,
        questionIds: lesson.questionIds,
        ...(lesson.theoryQuestionIds != null && {
          theoryQuestionIds: lesson.theoryQuestionIds,
        }),
        ...(lesson.testQuestionIds != null && {
          testQuestionIds: lesson.testQuestionIds,
        }),
        doc: { sha256: 'f'.repeat(64), sizeBytes: 1 },
      })),
    })),
  };
  const questions = new Map<string, CourseQuestionV2>();
  for (const doc of moduleDocs) {
    for (const question of doc.questions) {
      questions.set(question.questionId, question);
    }
  }
  state.questions = [...questions.values()];
  state.bankSha = 'primed';
  for (const doc of moduleDocs) {
    for (const lesson of doc.module.lessons) {
      state.lessonDocs.set(lesson.lessonId, {
        schemaVersion: 3,
        deliveryVersion: version,
        lesson,
        questions: doc.questions.filter(question =>
          lesson.questionIds.includes(question.questionId),
        ),
        assets: doc.assets,
      } as LessonDocV2);
    }
  }
  assemble(state);
  notify();
};

// Test seam: marks as a sync would have written them.
export const primeMarksForTests = (
  userId: string,
  courseId: string,
  marks: YellowMarks,
): void => {
  marksCache.set(`${userId}/${courseId}`, marks);
  notify();
};

// Test seam.
export const resetLazyForTests = (): void => {
  states.clear();
  marksCache.clear();
  listeners.clear();
};

// Exposed for the assembling tests: bank questions are the course questions.
export type { BankQuestionV1 };
