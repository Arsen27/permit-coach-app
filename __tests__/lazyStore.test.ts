import AsyncStorage from '@react-native-async-storage/async-storage';

import { resetAssetsForTests } from '@/data/assets/store';
import {
  fetchBankDocRaw,
  fetchLessonDocRaw,
  fetchOutlineRaw,
  fetchVerdictRaw,
} from '@/data/course/client';
import {
  clearMark,
  ensureLesson,
  narrowMark,
  hydrateLazyCourse,
  lazySnapshot,
  lessonLoaded,
  readMarks,
  resetLazyForTests,
  syncLazyCourse,
  takePrompt,
} from '@/data/course/lazy';
import { sha256Hex, utf8ByteLength } from '@/lib/sha256';

// The lazy store: a course works from the outline and the bank alone; lesson
// bodies arrive when opened and stay forever under their own hash; a replace
// lands wholesale and marks yellow only what the learner had completed.

jest.mock('@/data/course/client');
jest.mock('@/lib/serverConfig', () => ({
  SERVER_URL: 'http://test',
  isServerConfigured: true,
  APP_VERSION: '1.2.0',
}));

const mockVerdict = fetchVerdictRaw as jest.MockedFunction<
  typeof fetchVerdictRaw
>;
const mockOutline = fetchOutlineRaw as jest.MockedFunction<
  typeof fetchOutlineRaw
>;
const mockBank = fetchBankDocRaw as jest.MockedFunction<typeof fetchBankDocRaw>;
const mockLesson = fetchLessonDocRaw as jest.MockedFunction<
  typeof fetchLessonDocRaw
>;

const COURSE = 'ca-class-c' as const;

const question = (questionId: string) => ({
  questionId,
  uuid: '00000000-0000-5000-8000-000000000001',
  kind: 'lesson_test' as const,
  prompt: 'What now?',
  choices: [
    { id: 'a', text: 'stop', feedback: 'yes' },
    { id: 'b', text: 'go', feedback: 'no' },
    { id: 'c', text: 'honk', feedback: 'no' },
  ],
  correctAnswerId: 'a',
  explanation: 'because',
});

const bankBody = (ids: string[]) =>
  JSON.stringify({
    schemaVersion: 1,
    courseId: COURSE,
    questions: ids.map(question),
  });

const lessonDoc = (version: string, lessonId: string, title: string) => ({
  schemaVersion: 3,
  deliveryVersion: version,
  lesson: {
    lessonId,
    uuid: `00000000-0000-5000-8000-${sha256Hex(lessonId).slice(0, 12)}`,
    moduleId: 'm-one',
    globalSequence: 1,
    moduleSequence: 1,
    title,
    objective: 'objective',
    estimatedMinutes: '5-7',
    format: 'scenario_first_cards',
    blocks: [
      {
        blockId: `${lessonId}-b01`,
        type: 'quick_challenge',
        title: 'What would you do?',
        scenario: 's',
        questionPreview: 'p',
        questionId: `${lessonId}-q01`,
      },
    ],
    questionIds: [`${lessonId}-q01`],
    assetIds: [],
    language: 'en-US',
  },
  questions: [question(`${lessonId}-q01`)],
  assets: [],
});

const bodyOf = (doc: unknown) => `${JSON.stringify(doc, null, 2)}\n`;

const outlineBody = (
  version: string,
  lessons: { lessonId: string; title: string; doc: unknown }[],
) =>
  JSON.stringify({
    courseId: COURSE,
    version,
    title: 'California Class C',
    state: 'California',
    modules: [
      {
        moduleId: 'm-one',
        title: 'Module one',
        sequence: 1,
        moduleTestQuestionCount: 1,
        moduleTestQuestionIds: ['l-one-q01'],
        lessons: lessons.map(lesson => ({
          lessonId: lesson.lessonId,
          title: lesson.title,
          objective: 'objective',
          estimatedMinutes: '5-7',
          cardCount: 9,
          questionCount: 1,
          questionIds: [`${lesson.lessonId}-q01`],
          doc: {
            sha256: sha256Hex(bodyOf(lesson.doc)),
            sizeBytes: utf8ByteLength(bodyOf(lesson.doc)),
          },
        })),
      },
    ],
  });

const verdictBody = (over: {
  current: string;
  replace?: unknown;
  offer?: unknown;
  bankSha: string;
}) =>
  JSON.stringify({
    app: {
      minSupportedAppVersion: '1.0.0',
      latestAppVersion: '1.0.0',
      assetsBaseUrl: 'http://test/v1/assets',
    },
    course: {
      courseId: COURSE,
      channel: 'production',
      schemaVersion: 3,
      current: over.current,
      replace: over.replace ?? null,
      offer: over.offer ?? null,
      appUpdateRequired: false,
    },
    bank: { sha256: over.bankSha, sizeBytes: 1, updatedAt: 'now' },
    signs: null,
  });

const deps = (completed: string[] = []) => ({
  courseId: COURSE,
  userId: 'u1',
  completedLessonIds: completed,
});

const L1 = lessonDoc('1.1.1', 'l-one', 'Lesson one');
const L2 = lessonDoc('1.1.1', 'l-two', 'Lesson two');
const BANK1 = bankBody(['l-one-q01', 'l-two-q01']);

const serveVersion = (
  version: string,
  docs: Record<string, unknown>,
  bank: string,
) => {
  mockOutline.mockImplementation(async () =>
    outlineBody(
      version,
      Object.entries(docs).map(([lessonId, doc]) => ({
        lessonId,
        title: (doc as { lesson: { title: string } }).lesson.title,
        doc,
      })),
    ),
  );
  mockLesson.mockImplementation(async (_c, _v, lessonId) => {
    const doc = docs[lessonId];
    if (doc == null) {
      throw new Error(`no lesson ${lessonId}`);
    }
    return bodyOf(doc);
  });
  mockBank.mockResolvedValue(bank);
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  resetLazyForTests();
  resetAssetsForTests();
  globalThis.fetch = (async () => {
    throw new Error('unexpected network');
  }) as typeof fetch;
});

it('one sync makes a working course out of the outline and the bank', async () => {
  serveVersion('1.1.1', { 'l-one': L1, 'l-two': L2 }, BANK1);
  mockVerdict.mockResolvedValue(
    verdictBody({ current: '1.1.1', bankSha: sha256Hex(BANK1) }),
  );

  const result = await syncLazyCourse(deps());
  expect(result.status).toBe('ready');

  const held = lazySnapshot(COURSE)!;
  expect(held.deliveryVersion).toBe('1.1.1');
  // The structure is whole and the questions resolve — before any lesson
  // body has arrived.
  expect(held.bundle.modules[0].lessons).toHaveLength(2);
  expect(held.bundle.questions.map(q => q.questionId).sort()).toEqual([
    'l-one-q01',
    'l-two-q01',
  ]);
  expect(held.bundle.modules[0].lessons[0].blocks).toHaveLength(0);
  expect(lessonLoaded(COURSE, 'l-one')).toBe(false);
});

it('an opened lesson arrives verified, stays across a restart, and is never fetched twice', async () => {
  serveVersion('1.1.1', { 'l-one': L1, 'l-two': L2 }, BANK1);
  mockVerdict.mockResolvedValue(
    verdictBody({ current: '1.1.1', bankSha: sha256Hex(BANK1) }),
  );
  await syncLazyCourse(deps());

  expect(await ensureLesson(COURSE, 'l-one')).toBe('ready');
  expect(
    lazySnapshot(COURSE)!.bundle.modules[0].lessons[0].blocks,
  ).toHaveLength(1);

  // The phone restarts: memory is gone, storage is not, the network is dead.
  resetLazyForTests();
  mockLesson.mockRejectedValue(new Error('offline'));
  await hydrateLazyCourse(COURSE);
  expect(lessonLoaded(COURSE, 'l-one')).toBe(true);
  expect(await ensureLesson(COURSE, 'l-one')).toBe('ready');
  expect(mockLesson).toHaveBeenCalledTimes(1);
});

it('a body that does not match the outline hash is refused', async () => {
  serveVersion('1.1.1', { 'l-one': L1 }, BANK1);
  mockVerdict.mockResolvedValue(
    verdictBody({ current: '1.1.1', bankSha: sha256Hex(BANK1) }),
  );
  await syncLazyCourse(deps());
  mockLesson.mockResolvedValue(bodyOf(lessonDoc('1.1.1', 'l-one', 'Tampered')));

  expect(await ensureLesson(COURSE, 'l-one')).toBe('failed');
  expect(lessonLoaded(COURSE, 'l-one')).toBe(false);
});

it('a silent fix replaces wholesale: new outline, stale bodies dropped, kept hashes kept', async () => {
  serveVersion('1.1.1', { 'l-one': L1, 'l-two': L2 }, BANK1);
  mockVerdict.mockResolvedValue(
    verdictBody({ current: '1.1.1', bankSha: sha256Hex(BANK1) }),
  );
  await syncLazyCourse(deps());
  await ensureLesson(COURSE, 'l-one');
  await ensureLesson(COURSE, 'l-two');

  // 1.1.2 changes lesson two and keeps lesson one byte-identical.
  const L1KEPT = lessonDoc('1.1.1', 'l-one', 'Lesson one');
  const L2FIXED = lessonDoc('1.1.2', 'l-two', 'Lesson two, fixed');
  serveVersion('1.1.2', { 'l-one': L1KEPT, 'l-two': L2FIXED }, BANK1);
  mockVerdict.mockResolvedValue(
    verdictBody({
      current: '1.1.2',
      bankSha: sha256Hex(BANK1),
      replace: {
        version: '1.1.2',
        subtype: 'silent',
        changedLessons: ['l-two'],
        message: '',
      },
    }),
  );

  const result = await syncLazyCourse(deps(['l-one', 'l-two']));
  expect(result.status).toBe('ready');
  expect(result.prompt).toBeUndefined();
  expect(lazySnapshot(COURSE)!.deliveryVersion).toBe('1.1.2');
  // The unchanged lesson kept its body; the changed one waits to be opened.
  expect(lessonLoaded(COURSE, 'l-one')).toBe(true);
  expect(lessonLoaded(COURSE, 'l-two')).toBe(false);
  // And nothing was marked yellow.
  expect(await readMarks('u1', COURSE)).toEqual({});
});

it('an apology fix marks what the learner had completed, and the prompt survives a kill', async () => {
  serveVersion('1.1.1', { 'l-one': L1, 'l-two': L2 }, BANK1);
  mockVerdict.mockResolvedValue(
    verdictBody({ current: '1.1.1', bankSha: sha256Hex(BANK1) }),
  );
  await syncLazyCourse(deps());

  const L2FIXED = lessonDoc('1.1.2', 'l-two', 'Lesson two, corrected');
  serveVersion('1.1.2', { 'l-one': L1, 'l-two': L2FIXED }, BANK1);
  mockVerdict.mockResolvedValue(
    verdictBody({
      current: '1.1.2',
      bankSha: sha256Hex(BANK1),
      replace: {
        version: '1.1.2',
        subtype: 'apology',
        changedLessons: ['l-one', 'l-two'],
        message: 'We are sorry — lesson two was wrong.',
      },
    }),
  );

  // Only lesson two was completed, so only it is marked.
  const result = await syncLazyCourse(deps(['l-two']));
  expect(result.prompt).toEqual({
    kind: 'apology',
    message: 'We are sorry — lesson two was wrong.',
    lessonIds: ['l-two'],
  });
  expect(await readMarks('u1', COURSE)).toEqual({ 'l-two': {} });

  // A kill before the modal was seen: the prompt is still there.
  expect(await takePrompt('u1')).toEqual(result.prompt);

  // Completing the lesson again clears its yellow.
  await clearMark('u1', COURSE, 'l-two');
  expect(await readMarks('u1', COURSE)).toEqual({});
});

it('an offer is handed through, never applied', async () => {
  serveVersion('1.1.1', { 'l-one': L1 }, BANK1);
  mockVerdict.mockResolvedValue(
    verdictBody({
      current: '2.0.0',
      bankSha: sha256Hex(BANK1),
      offer: { version: '2.0.0', message: 'A brand-new course.' },
    }),
  );
  await syncLazyCourse(deps());
  const result = await syncLazyCourse(deps());
  expect(result.offer).toEqual({
    version: '2.0.0',
    message: 'A brand-new course.',
  });
});

it('offline keeps everything and says so; a bad bank changes nothing', async () => {
  serveVersion('1.1.1', { 'l-one': L1 }, BANK1);
  mockVerdict.mockResolvedValue(
    verdictBody({ current: '1.1.1', bankSha: sha256Hex(BANK1) }),
  );
  await syncLazyCourse(deps());

  mockVerdict.mockRejectedValue(new Error('no network'));
  expect((await syncLazyCourse(deps())).status).toBe('offline');
  expect(lazySnapshot(COURSE)!.deliveryVersion).toBe('1.1.1');

  // A bank that does not match its published hash is refused whole.
  const BANK2 = bankBody(['l-one-q01']);
  mockVerdict.mockResolvedValue(
    verdictBody({ current: '1.1.1', bankSha: sha256Hex(BANK2) }),
  );
  mockBank.mockResolvedValue(BANK1);
  expect((await syncLazyCourse(deps())).status).toBe('failed');
  expect(
    lazySnapshot(COURSE)!
      .bundle.questions.map(q => q.questionId)
      .sort(),
  ).toEqual(['l-one-q01', 'l-two-q01']);
});

it('a mark narrows to the changed blocks the moment the new body arrives', async () => {
  serveVersion('1.1.1', { 'l-one': L1, 'l-two': L2 }, BANK1);
  mockVerdict.mockResolvedValue(
    verdictBody({ current: '1.1.1', bankSha: sha256Hex(BANK1) }),
  );
  await syncLazyCourse(deps());
  // The learner had opened and completed lesson two on the old version.
  await ensureLesson(COURSE, 'l-two');

  const L2FIXED = lessonDoc('1.1.2', 'l-two', 'Lesson two');
  (L2FIXED.lesson.blocks[0] as { title: string }).title = 'Corrected challenge';
  serveVersion('1.1.2', { 'l-one': L1, 'l-two': L2FIXED }, BANK1);
  mockVerdict.mockResolvedValue(
    verdictBody({
      current: '1.1.2',
      bankSha: sha256Hex(BANK1),
      replace: {
        version: '1.1.2',
        subtype: 'rules',
        changedLessons: ['l-two'],
        message: 'The rules changed.',
      },
    }),
  );
  await syncLazyCourse(deps(['l-two']));

  // Until the new body arrives, the mark remembers the old blocks.
  const before = await readMarks('u1', COURSE);
  expect(before['l-two'].oldBlockHashes).toBeDefined();

  await ensureLesson(COURSE, 'l-two');
  await narrowMark('u1', COURSE, 'l-two');
  const after = await readMarks('u1', COURSE);
  expect(after['l-two']).toEqual({ blocks: ['l-two-b01'] });

  // Completing the lesson again clears it.
  await clearMark('u1', COURSE, 'l-two');
  expect(await readMarks('u1', COURSE)).toEqual({});
});
