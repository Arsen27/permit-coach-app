import AsyncStorage from '@react-native-async-storage/async-storage';

import { SEED_DELIVERY_VERSION } from '@/data/course';
import {
  fetchBootstrapRaw,
  fetchCourseDocRaw,
  fetchLessonDocRaw,
  fetchModuleDocRaw,
} from '@/data/course/client';
import { loadPrompt } from '@/data/course/promptStore';
import { courseStore } from '@/data/course/store';
import {
  acceptCourseOffer,
  foldLessonIntoModule,
  runCourseUpdate,
} from '@/data/course/updater';
import type {
  BootstrapResponseV2,
  CourseDocV2,
  CourseLessonV2,
  CourseQuestionV2,
  LessonDocV2,
  ManifestVersionV2,
  ModuleDocV2,
  UpdateInstructionV2,
} from '@/data/course/v2/wire';
import { sha256Hex, utf8ByteLength } from '@/lib/sha256';

// Fixture delivery versions must sit above whatever the bundled seed ships,
// or the updater correctly reports "up-to-date" and the tests never exercise
// an update. Derived so a seed bump does not silently disable them.
const SEED_MAJOR = Number(SEED_DELIVERY_VERSION.split('.')[0]);
const NEXT_VERSION = `${SEED_MAJOR + 1}.0.0`;
const LATER_VERSION = `${SEED_MAJOR + 2}.0.0`;

jest.mock('@/data/course/client');
jest.mock('@/lib/serverConfig', () => ({
  SERVER_URL: 'http://test',
  isServerConfigured: true,
  APP_VERSION: '1.0.0',
}));

const mockBootstrap = fetchBootstrapRaw as jest.MockedFunction<
  typeof fetchBootstrapRaw
>;
const mockCourse = fetchCourseDocRaw as jest.MockedFunction<
  typeof fetchCourseDocRaw
>;
const mockModule = fetchModuleDocRaw as jest.MockedFunction<
  typeof fetchModuleDocRaw
>;
const mockLesson = fetchLessonDocRaw as jest.MockedFunction<
  typeof fetchLessonDocRaw
>;

// ---------------------------------------------------------------------------
// A tiny but wire-valid two-module course fixture.

let uuidCounter = 0;
const uid = (): string =>
  `00000000-0000-5000-8000-${String(uuidCounter++).padStart(12, '0')}`;

const M1 = 'ca-mod-one';
const M2 = 'ca-mod-two';
const L1 = 'ca-les-one';
const L2 = 'ca-les-two';

const questionFx = (
  questionId: string,
  assetId: string,
  prompt = 'Question?',
): CourseQuestionV2 => ({
  questionId,
  uuid: uid(),
  kind: 'opening_challenge',
  prompt,
  choices: [
    { id: 'A', text: 'a', feedback: 'fa' },
    { id: 'B', text: 'b', feedback: 'fb' },
    { id: 'C', text: 'c', feedback: 'fc' },
  ],
  correctAnswerId: 'A',
  explanation: 'because',
  assetId,
});

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"/>';

const assetFx = (assetId: string) => ({
  assetId,
  uuid: uid(),
  type: 'svg' as const,
  width: 1200,
  height: 675,
  alt: `alt ${assetId}`,
  sha256: sha256Hex(SVG),
  svgXml: SVG,
});

const lessonFx = (
  lessonId: string,
  moduleId: string,
  globalSequence: number,
  questionId: string,
  assetId: string,
  title = lessonId,
): CourseLessonV2 => ({
  lessonId,
  uuid: uid(),
  moduleId,
  globalSequence,
  moduleSequence: 1,
  title,
  objective: 'o',
  estimatedMinutes: '5-7',
  format: 'scenario_first_cards',
  blocks: [
    {
      blockId: `${lessonId}-b01`,
      type: 'quick_challenge',
      title: 'What would you do?',
      scenario: 's',
      questionPreview: 'p',
      questionId,
    },
  ],
  questionIds: [questionId],
  assetIds: [assetId],
  language: 'en-US',
});

type Fixture = {
  courseDoc: CourseDocV2;
  moduleDocs: ModuleDocV2[];
  lessonDocs: LessonDocV2[];
  bodies: Map<string, string>;
  entry: (instructions: UpdateInstructionV2[]) => ManifestVersionV2;
};

const buildFixture = (
  deliveryVersion: string,
  overrides: { lessonTitle?: string } = {},
): Fixture => {
  const q1 = questionFx(`${L1}-q01`, `${L1}-a01`);
  const q2 = questionFx(`${L2}-q01`, `${L2}-a01`);
  const a1 = assetFx(`${L1}-a01`);
  const a2 = assetFx(`${L2}-a01`);
  const lesson1 = lessonFx(
    L1,
    M1,
    1,
    q1.questionId,
    a1.assetId,
    overrides.lessonTitle,
  );
  const lesson2 = lessonFx(L2, M2, 2, q2.questionId, a2.assetId);

  const moduleDocs: ModuleDocV2[] = [
    {
      schemaVersion: 2,
      deliveryVersion,
      module: {
        moduleId: M1,
        uuid: uid(),
        sequence: 1,
        title: 'Module one',
        outcome: 'outcome one',
        lessons: [lesson1],
        moduleTest: {
          testId: `${M1}-test`,
          uuid: uid(),
          moduleId: M1,
          questionIds: [q1.questionId],
        },
      },
      questions: [q1],
      assets: [a1],
    },
    {
      schemaVersion: 2,
      deliveryVersion,
      module: {
        moduleId: M2,
        uuid: uid(),
        sequence: 2,
        title: 'Module two',
        outcome: 'outcome two',
        lessons: [lesson2],
        moduleTest: {
          testId: `${M2}-test`,
          uuid: uid(),
          moduleId: M2,
          questionIds: [q2.questionId],
        },
      },
      questions: [q2],
      assets: [a2],
    },
  ];
  const lessonDocs: LessonDocV2[] = [
    {
      schemaVersion: 2,
      deliveryVersion,
      lesson: lesson1,
      questions: [q1],
      assets: [a1],
    },
    {
      schemaVersion: 2,
      deliveryVersion,
      lesson: lesson2,
      questions: [q2],
      assets: [a2],
    },
  ];
  const courseDoc: CourseDocV2 = {
    schemaVersion: 2,
    deliveryVersion,
    course: {
      courseId: 'ca-class-c',
      title: 't',
      subtitle: 's',
      jurisdiction: 'CA',
      state: 'California',
      language: 'en-US',
      targetLicense: 'x',
      moduleIds: [M1, M2],
      sourceVersionLabel: 'TEST',
      sourceContentHash: 'h'.repeat(64),
      sourceCheckedAt: '2026-08-10',
      sourceReviewStatus: 'draft_generated_human_review_required',
      publicationAuthorized: false,
    },
  };

  const bodies = new Map<string, string>([
    ['course', JSON.stringify(courseDoc)],
    [`modules/${M1}`, JSON.stringify(moduleDocs[0])],
    [`modules/${M2}`, JSON.stringify(moduleDocs[1])],
    [`lessons/${L1}`, JSON.stringify(lessonDocs[0])],
    [`lessons/${L2}`, JSON.stringify(lessonDocs[1])],
  ]);

  const ref = (key: string) => ({
    sha256: sha256Hex(bodies.get(key)!),
    sizeBytes: utf8ByteLength(bodies.get(key)!),
  });

  return {
    courseDoc,
    moduleDocs,
    lessonDocs,
    bodies,
    entry: instructions => ({
      version: deliveryVersion,
      releasedAt: '2026-08-12',
      status: 'release_candidate',
      minAppVersion: '1.0.0',
      sourceVersionLabel: 'TEST',
      sourceReviewStatus: 'draft_generated_human_review_required',
      publicationAuthorized: false,
      instructions,
      documents: {
        course: ref('course'),
        modules: { [M1]: ref(`modules/${M1}`), [M2]: ref(`modules/${M2}`) },
        lessons: {
          [L1]: { ...ref(`lessons/${L1}`), moduleId: M1 },
          [L2]: { ...ref(`lessons/${L2}`), moduleId: M2 },
        },
      },
    }),
  };
};

const serveFixture = (fixture: Fixture) => {
  mockCourse.mockImplementation(async () => fixture.bodies.get('course')!);
  mockModule.mockImplementation(async (_c, _v, moduleId) => {
    const body = fixture.bodies.get(`modules/${moduleId}`);
    if (body == null) {
      throw new Error(`no fixture module ${moduleId}`);
    }
    return body;
  });
  mockLesson.mockImplementation(async (_c, _v, lessonId) => {
    const body = fixture.bodies.get(`lessons/${lessonId}`);
    if (body == null) {
      throw new Error(`no fixture lesson ${lessonId}`);
    }
    return body;
  });
};

const bootstrapBody = (
  overrides: Partial<BootstrapResponseV2['course']> & {
    minSupportedAppVersion?: string;
  } = {},
): string => {
  const { minSupportedAppVersion, ...course } = overrides;
  return JSON.stringify({
    app: {
      minSupportedAppVersion: minSupportedAppVersion ?? '1.0.0',
      latestAppVersion: '1.0.0',
    },
    course: {
      courseId: 'ca-class-c',
      schemaVersion: 2,
      latestVersion: SEED_DELIVERY_VERSION,
      mode: 'none',
      pendingVersions: [],
      ...course,
    },
  });
};

const deps = () => ({
  userId: 'u1',
  getProgress: jest.fn(() => ({
    lessonIds: [] as string[],
    topicIds: [] as string[],
  })),
  resetLessons: jest.fn(),
  resetTopics: jest.fn(),
});

const commitFixture = async (fixture: Fixture, version: string) => {
  await courseStore.commit(version, fixture.courseDoc, fixture.moduleDocs);
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  courseStore.resetForTests();
});

describe('runCourseUpdate (v2)', () => {
  it('reports offline when bootstrap is unreachable and touches nothing', async () => {
    mockBootstrap.mockRejectedValue(new Error('network'));
    const d = deps();
    const result = await runCourseUpdate(d);
    expect(result.status).toBe('offline');
    expect(mockCourse).not.toHaveBeenCalled();
    expect(courseStore.getSnapshot().deliveryVersion).toBe(
      SEED_DELIVERY_VERSION,
    );
  });

  it('refuses to download anything when the app is below the version gate', async () => {
    const fixture = buildFixture(NEXT_VERSION);
    serveFixture(fixture);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        minSupportedAppVersion: '9.9.9',
        latestVersion: NEXT_VERSION,
        mode: 'full',
        pendingVersions: [fixture.entry([{ op: 'full', severity: 'soft' }])],
        progressFallback: { severity: 'soft' },
      }),
    );
    const result = await runCourseUpdate(deps());
    expect(result.status).toBe('app-update-required');
    expect(mockCourse).not.toHaveBeenCalled();
    expect(mockModule).not.toHaveBeenCalled();
    expect(courseStore.getSnapshot().deliveryVersion).toBe(
      SEED_DELIVERY_VERSION,
    );
  });

  it('refuses a manifest whose schemaVersion the app cannot parse', async () => {
    const fixture = buildFixture(NEXT_VERSION);
    serveFixture(fixture);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        schemaVersion: 3,
        latestVersion: NEXT_VERSION,
        mode: 'full',
        pendingVersions: [fixture.entry([{ op: 'full', severity: 'soft' }])],
        progressFallback: { severity: 'soft' },
      }),
    );
    const result = await runCourseUpdate(deps());
    expect(result.status).toBe('app-update-required');
    expect(mockCourse).not.toHaveBeenCalled();
  });

  it('refuses the target version when the app is below its own minAppVersion', async () => {
    const fixture = buildFixture(NEXT_VERSION);
    serveFixture(fixture);
    const entry = {
      ...fixture.entry([{ op: 'full', severity: 'soft' }]),
      minAppVersion: '2.0.0',
    };
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: NEXT_VERSION,
        mode: 'full',
        pendingVersions: [entry],
        progressFallback: { severity: 'soft' },
      }),
    );
    const result = await runCourseUpdate(deps());
    expect(result.status).toBe('app-update-required');
    expect(mockCourse).not.toHaveBeenCalled();
  });

  it('rejects a mode-full bootstrap without an explicit progressFallback', async () => {
    const fixture = buildFixture(NEXT_VERSION);
    serveFixture(fixture);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: NEXT_VERSION,
        mode: 'full',
        pendingVersions: [fixture.entry([{ op: 'full', severity: 'soft' }])],
      }),
    );
    const result = await runCourseUpdate(deps());
    expect(result.status).toBe('failed');
    expect(mockCourse).not.toHaveBeenCalled();
  });

  it('performs a full update: all module docs fetched, verified and committed', async () => {
    const fixture = buildFixture(NEXT_VERSION);
    serveFixture(fixture);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: NEXT_VERSION,
        mode: 'full',
        pendingVersions: [fixture.entry([{ op: 'full', severity: 'soft' }])],
        progressFallback: { severity: 'soft' },
      }),
    );
    const d = deps();
    const result = await runCourseUpdate(d);
    expect(result.status).toBe('updated');
    expect(mockModule).toHaveBeenCalledTimes(2);
    expect(mockLesson).not.toHaveBeenCalled();
    const snapshot = courseStore.getSnapshot();
    expect(snapshot.deliveryVersion).toBe(NEXT_VERSION);
    expect(snapshot.bundle.modules.map(m => m.moduleId)).toEqual([M1, M2]);
    // soft fallback: no resets, no prompt
    expect(d.resetLessons).toHaveBeenCalledWith([]);
    expect(d.resetTopics).toHaveBeenCalledWith([]);
    expect(await loadPrompt('u1')).toBeNull();
  });

  it('applies the explicit hard progressFallback for unknown client versions', async () => {
    const fixture = buildFixture(NEXT_VERSION);
    serveFixture(fixture);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: NEXT_VERSION,
        mode: 'full',
        pendingVersions: [fixture.entry([{ op: 'full', severity: 'soft' }])],
        progressFallback: { severity: 'hard', message: 'rebuilt' },
      }),
    );
    const d = deps();
    d.getProgress.mockReturnValue({
      lessonIds: ['ca-started-lesson'],
      topicIds: ['road-signs'],
    });
    const result = await runCourseUpdate(d);
    expect(result.status).toBe('updated');
    expect(d.resetLessons).toHaveBeenCalledWith(['ca-started-lesson']);
    expect(d.resetTopics).toHaveBeenCalledWith([]);
    expect((await loadPrompt('u1'))?.kind).toBe('hard');
  });

  it('fetches only the affected LessonDoc for a lesson-content delta', async () => {
    const base = buildFixture(NEXT_VERSION);
    await commitFixture(base, NEXT_VERSION);
    const next = buildFixture(LATER_VERSION, {
      lessonTitle: 'Retitled lesson',
    });
    serveFixture(next);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: LATER_VERSION,
        mode: 'delta',
        pendingVersions: [
          next.entry([
            { op: 'lesson-content', lessonId: L1, severity: 'soft' },
          ]),
        ],
      }),
    );
    const result = await runCourseUpdate(deps());
    expect(result.status).toBe('updated');
    expect(mockLesson).toHaveBeenCalledTimes(1);
    expect(mockLesson).toHaveBeenCalledWith('ca-class-c', LATER_VERSION, L1);
    expect(mockModule).not.toHaveBeenCalled();
    const snapshot = courseStore.getSnapshot();
    expect(snapshot.deliveryVersion).toBe(LATER_VERSION);
    expect(snapshot.bundle.modules[0].lessons[0].title).toBe('Retitled lesson');
    // The untouched module was carried forward, not downloaded.
    expect(snapshot.bundle.modules[1].lessons[0].title).toBe(L2);
  });

  it('fetches the ModuleDoc for a module-test question delta', async () => {
    const base = buildFixture(NEXT_VERSION);
    await commitFixture(base, NEXT_VERSION);
    const next = buildFixture(LATER_VERSION);
    serveFixture(next);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: LATER_VERSION,
        mode: 'delta',
        pendingVersions: [
          next.entry([
            {
              op: 'question',
              questionId: `${L1}-q01`,
              moduleId: M1,
              severity: 'soft',
            },
          ]),
        ],
      }),
    );
    const result = await runCourseUpdate(deps());
    expect(result.status).toBe('updated');
    expect(mockModule).toHaveBeenCalledTimes(1);
    expect(mockModule).toHaveBeenCalledWith('ca-class-c', LATER_VERSION, M1);
    expect(mockLesson).not.toHaveBeenCalled();
  });

  it('aborts the whole content phase when a document hash does not match', async () => {
    const base = buildFixture(NEXT_VERSION);
    await commitFixture(base, NEXT_VERSION);
    const next = buildFixture(LATER_VERSION);
    serveFixture(next);
    // Manifest hashes describe the intact bytes…
    const entry = next.entry([
      { op: 'lesson-content', lessonId: L1, severity: 'soft' },
    ]);
    // …but the server delivers a corrupted body.
    next.bodies.set(`lessons/${L1}`, next.bodies.get(`lessons/${L1}`)! + ' ');
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: LATER_VERSION,
        mode: 'delta',
        pendingVersions: [entry],
      }),
    );
    const d = deps();
    const result = await runCourseUpdate(d);
    expect(result.status).toBe('failed');
    expect(courseStore.getSnapshot().deliveryVersion).toBe(NEXT_VERSION);
    // Progress phase never ran; the seen cursor stays put for a clean retry.
    expect(d.resetLessons).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('dmv-prep/course-seen/v2/u1')).toBe(
      NEXT_VERSION,
    );
  });

  it('aborts when a document fails structural validation', async () => {
    const base = buildFixture(NEXT_VERSION);
    await commitFixture(base, NEXT_VERSION);
    const next = buildFixture(LATER_VERSION);
    // Break the module doc: dangling module-test question ref.
    const broken = JSON.parse(next.bodies.get(`modules/${M1}`)!);
    broken.module.moduleTest.questionIds = ['ghost-question'];
    const brokenBody = JSON.stringify(broken);
    next.bodies.set(`modules/${M1}`, brokenBody);
    const entry = next.entry([
      { op: 'module', moduleId: M1, severity: 'soft' },
    ]);
    entry.documents.modules[M1] = {
      sha256: sha256Hex(brokenBody),
      sizeBytes: utf8ByteLength(brokenBody),
    };
    serveFixture(next);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: LATER_VERSION,
        mode: 'delta',
        pendingVersions: [entry],
      }),
    );
    const result = await runCourseUpdate(deps());
    expect(result.status).toBe('failed');
    expect(courseStore.getSnapshot().deliveryVersion).toBe(NEXT_VERSION);
  });

  it('commits content before the progress pass and resumes after a kill in between', async () => {
    const fixture = buildFixture(LATER_VERSION);
    // Content already committed (phase 1 finished), but the per-user seen
    // cursor still points at the old version — as after a mid-update kill.
    await commitFixture(fixture, LATER_VERSION);
    await AsyncStorage.setItem('dmv-prep/course-seen/v2/u1', NEXT_VERSION);
    serveFixture(fixture);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: LATER_VERSION,
        mode: 'delta',
        pendingVersions: [
          fixture.entry([
            { op: 'lesson-content', lessonId: L1, severity: 'hard' },
          ]),
        ],
      }),
    );
    const d = deps();
    d.getProgress.mockReturnValue({ lessonIds: [L1], topicIds: [] });
    const result = await runCourseUpdate(d);
    expect(result.status).toBe('updated');
    // No content work — only the progress phase ran.
    expect(mockCourse).not.toHaveBeenCalled();
    expect(mockLesson).not.toHaveBeenCalled();
    expect(d.resetLessons).toHaveBeenCalledWith([L1]);
    expect(await AsyncStorage.getItem('dmv-prep/course-seen/v2/u1')).toBe(
      LATER_VERSION,
    );
    expect((await loadPrompt('u1'))?.kind).toBe('hard');
  });

  it('runs the progress pass against the already-committed new bundle', async () => {
    const base = buildFixture(NEXT_VERSION);
    await commitFixture(base, NEXT_VERSION);
    const next = buildFixture(LATER_VERSION);
    serveFixture(next);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: LATER_VERSION,
        mode: 'delta',
        pendingVersions: [
          next.entry([{ op: 'module', moduleId: M1, severity: 'hard' }]),
        ],
      }),
    );
    const d = deps();
    d.getProgress.mockReturnValue({ lessonIds: [L1], topicIds: [M1] });
    let versionAtReset: string | null = null;
    d.resetLessons.mockImplementation(() => {
      versionAtReset = courseStore.getSnapshot().deliveryVersion;
    });
    const result = await runCourseUpdate(d);
    expect(result.status).toBe('updated');
    // Content was committed before any progress action fired.
    expect(versionAtReset).toBe(LATER_VERSION);
    expect(d.resetLessons).toHaveBeenCalledWith([L1]);
    expect(d.resetTopics).toHaveBeenCalledWith([M1]);
  });
});

describe('foldLessonIntoModule (v2)', () => {
  it('replaces the lesson with its questions and assets, dropping unreferenced ones', () => {
    const fixture = buildFixture(LATER_VERSION);
    const target = fixture.moduleDocs[0];
    const newQuestion = questionFx(`${L1}-q02`, `${L1}-a02`, 'New question?');
    const newAsset = assetFx(`${L1}-a02`);
    const newLesson: CourseLessonV2 = {
      ...target.module.lessons[0],
      title: 'Patched',
      blocks: [
        {
          blockId: `${L1}-b01`,
          type: 'quick_challenge',
          title: 'T',
          scenario: 's',
          questionPreview: 'p',
          questionId: newQuestion.questionId,
        },
      ],
      questionIds: [newQuestion.questionId],
      assetIds: [newAsset.assetId],
    };
    const patched: ModuleDocV2 = {
      schemaVersion: 2,
      deliveryVersion: LATER_VERSION,
      module: {
        ...target.module,
        moduleTest: {
          ...target.module.moduleTest,
          questionIds: [newQuestion.questionId],
        },
      },
      questions: target.questions,
      assets: target.assets,
    };
    const folded = foldLessonIntoModule(patched, {
      schemaVersion: 2,
      deliveryVersion: LATER_VERSION,
      lesson: newLesson,
      questions: [newQuestion],
      assets: [newAsset],
    });
    expect(folded.module.lessons.map(l => l.title)).toEqual(['Patched']);
    expect(folded.questions.map(q => q.questionId)).toEqual([
      newQuestion.questionId,
    ]);
    expect(folded.assets.map(a => a.assetId)).toEqual([newAsset.assetId]);
  });

  it('throws on a dangling reference instead of committing a broken module', () => {
    const fixture = buildFixture(LATER_VERSION);
    const target = fixture.moduleDocs[0];
    const orphanLesson: CourseLessonV2 = {
      ...target.module.lessons[0],
      questionIds: ['ghost-question'],
      blocks: [],
      assetIds: [],
    };
    expect(() =>
      foldLessonIntoModule(target, {
        schemaVersion: 2,
        deliveryVersion: LATER_VERSION,
        lesson: orphanLesson,
        questions: [],
        assets: [],
      }),
    ).toThrow(/dangling question reference/);
  });
});

describe('opt-in course offers (v2)', () => {
  const optInEntry = (fixture: Fixture, notes: string): ManifestVersionV2 => ({
    ...fixture.entry([{ op: 'full', severity: 'soft' }]),
    adoption: 'opt_in',
    notes,
  });

  it('stops automatic updates below the opt-in boundary and surfaces the offer', async () => {
    const auto = buildFixture(NEXT_VERSION);
    const offered = buildFixture(LATER_VERSION);
    serveFixture(auto);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: LATER_VERSION,
        mode: 'delta',
        pendingVersions: [
          auto.entry([{ op: 'full', severity: 'soft' }]),
          optInEntry(offered, 'A rebuilt course'),
        ],
      }),
    );

    const result = await runCourseUpdate(deps());

    // The automatic stretch still landed…
    expect(result.status).toBe('updated');
    expect(courseStore.getSnapshot().deliveryVersion).toBe(NEXT_VERSION);
    // …but the opt-in version was only offered, never fetched.
    expect(result.offer).toEqual({
      version: LATER_VERSION,
      notes: 'A rebuilt course',
    });
  });

  it('downloads nothing when the opt-in version is the only pending one', async () => {
    const offered = buildFixture(LATER_VERSION);
    serveFixture(offered);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: LATER_VERSION,
        mode: 'delta',
        pendingVersions: [optInEntry(offered, 'A rebuilt course')],
      }),
    );

    const result = await runCourseUpdate(deps());

    expect(result.status).toBe('up-to-date');
    expect(result.offer?.version).toBe(LATER_VERSION);
    expect(mockCourse).not.toHaveBeenCalled();
    expect(courseStore.getSnapshot().deliveryVersion).toBe(
      SEED_DELIVERY_VERSION,
    );
  });

  it('withholds the offer from an app below the new course minAppVersion', async () => {
    const offered = buildFixture(LATER_VERSION);
    serveFixture(offered);
    const entry = { ...optInEntry(offered, 'notes'), minAppVersion: '9.9.9' };
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: LATER_VERSION,
        mode: 'delta',
        pendingVersions: [entry],
      }),
    );

    const result = await runCourseUpdate(deps());

    expect(result.status).toBe('up-to-date');
    expect(result.offer).toBeUndefined();
  });

  it('accepting downloads the new course and starts progress fresh', async () => {
    const offered = buildFixture(LATER_VERSION);
    serveFixture(offered);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: LATER_VERSION,
        mode: 'delta',
        pendingVersions: [optInEntry(offered, 'A rebuilt course')],
      }),
    );
    const oldBundle = courseStore.getSnapshot().bundle;
    const oldLessonIds = oldBundle.modules.flatMap(module =>
      module.lessons.map(lesson => lesson.lessonId),
    );
    const oldModuleIds = oldBundle.modules.map(module => module.moduleId);

    const d = deps();
    const result = await acceptCourseOffer(d);

    expect(result.status).toBe('updated');
    expect(courseStore.getSnapshot().deliveryVersion).toBe(LATER_VERSION);
    // The fresh start wipes exactly what the OLD course tracked.
    expect(d.resetLessons).toHaveBeenCalledWith(oldLessonIds);
    expect(d.resetTopics).toHaveBeenCalledWith(oldModuleIds);
    // The seen cursor lands on the accepted version: no stray prompts later.
    expect(await AsyncStorage.getItem('dmv-prep/course-seen/v2/u1')).toBe(
      LATER_VERSION,
    );
    expect(await loadPrompt('u1')).toBeNull();
  });

  it('a failed accept commits nothing and wipes nothing', async () => {
    const offered = buildFixture(LATER_VERSION);
    serveFixture(offered);
    mockCourse.mockRejectedValue(new Error('network died mid-download'));
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: LATER_VERSION,
        mode: 'delta',
        pendingVersions: [optInEntry(offered, 'A rebuilt course')],
      }),
    );

    const d = deps();
    const result = await acceptCourseOffer(d);

    expect(result.status).toBe('failed');
    expect(courseStore.getSnapshot().deliveryVersion).toBe(
      SEED_DELIVERY_VERSION,
    );
    expect(d.resetLessons).not.toHaveBeenCalled();
    expect(d.resetTopics).not.toHaveBeenCalled();
  });
});
