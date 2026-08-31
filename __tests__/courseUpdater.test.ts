import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  fetchBootstrapRaw,
  fetchCourseDocRaw,
  fetchLessonDocRaw,
  fetchModuleDocRaw,
} from '@/data/course/client';
import {
  assetSource,
  clearAssets,
  missingAssets,
  primeVectorsForTests,
  resetAssetsForTests,
  vectorMarkup,
  warmAssets,
} from '@/data/assets/store';
import { loadPrompt } from '@/data/course/promptStore';
import { courseStore } from '@/data/course/store';
import {
  acceptCourseOffer,
  foldLessonIntoModule,
  installCourse,
  runCourseUpdate,
} from '@/data/course/updater';
import { COURSE_SCHEMA_VERSION } from '@/data/course/v2/wire';
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
import {
  getContentChannel,
  resetContentChannelForTests,
} from '@/lib/contentChannel';
import { sha256Hex, utf8ByteLength } from '@/lib/sha256';

// The app bundles no course: every update test starts from a committed
// BASE_VERSION (see the beforeEach below), and the fixtures released after it
// sit above it so the updater actually has something to do.
const BASE_VERSION = '1.0.0';
const NEXT_VERSION = '2.0.0';
const LATER_VERSION = '3.0.0';

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

// Real content derives a uuid from the entity's stable id, so the same entity
// carries the same uuid across releases. A counter here would hand every
// rebuild of a fixture new ids, and an untouched module would look changed.
const uid = (seed: string): string =>
  `00000000-0000-5000-8000-${sha256Hex(seed).slice(0, 12)}`;

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
  uuid: uid(questionId),
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

const SVG2 =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect/></svg>';

const assetFx = (assetId: string, svg = SVG) => ({
  assetId,
  uuid: uid(assetId),
  mime: 'image/svg+xml' as const,
  width: 1200,
  height: 675,
  alt: `alt ${assetId}`,
  sha256: sha256Hex(svg),
  sizeBytes: utf8ByteLength(svg),
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
  uuid: uid(lessonId),
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
  overrides: {
    lessonTitle?: string;
    // The picture each lesson shows; the same one unless said otherwise.
    svgs?: [string, string];
    courseId?: string;
  } = {},
): Fixture => {
  const q1 = questionFx(`${L1}-q01`, `${L1}-a01`);
  const q2 = questionFx(`${L2}-q01`, `${L2}-a01`);
  const a1 = assetFx(`${L1}-a01`, overrides.svgs?.[0]);
  const a2 = assetFx(`${L2}-a01`, overrides.svgs?.[1]);
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
      schemaVersion: COURSE_SCHEMA_VERSION,
      deliveryVersion,
      module: {
        moduleId: M1,
        uuid: uid(M1),
        sequence: 1,
        title: 'Module one',
        outcome: 'outcome one',
        lessons: [lesson1],
        moduleTest: {
          testId: `${M1}-test`,
          uuid: uid(`${M1}-test`),
          moduleId: M1,
          questionIds: [q1.questionId],
        },
      },
      questions: [q1],
      assets: [a1],
    },
    {
      schemaVersion: COURSE_SCHEMA_VERSION,
      deliveryVersion,
      module: {
        moduleId: M2,
        uuid: uid(M2),
        sequence: 2,
        title: 'Module two',
        outcome: 'outcome two',
        lessons: [lesson2],
        moduleTest: {
          testId: `${M2}-test`,
          uuid: uid(`${M2}-test`),
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
      schemaVersion: COURSE_SCHEMA_VERSION,
      deliveryVersion,
      lesson: lesson1,
      questions: [q1],
      assets: [a1],
    },
    {
      schemaVersion: COURSE_SCHEMA_VERSION,
      deliveryVersion,
      lesson: lesson2,
      questions: [q2],
      assets: [a2],
    },
  ];
  const courseDoc: CourseDocV2 = {
    schemaVersion: COURSE_SCHEMA_VERSION,
    deliveryVersion,
    course: {
      courseId: overrides.courseId ?? 'ca-class-c',
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

  // Exactly how the server writes a document — the hashes in a manifest are
  // taken over this form, and the updater rebuilds carried-forward modules
  // into it to check them, so a fixture that serialised differently would
  // misrepresent the wire format.
  const serialize = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
  const bodies = new Map<string, string>([
    ['course', serialize(courseDoc)],
    [`modules/${M1}`, serialize(moduleDocs[0])],
    [`modules/${M2}`, serialize(moduleDocs[1])],
    [`lessons/${L1}`, serialize(lessonDocs[0])],
    [`lessons/${L2}`, serialize(lessonDocs[1])],
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

// The content server's asset route, for the store that fetches pictures:
// each picture answers under the hash of its own bytes.
const serveAssets = (svgs: string[] = [SVG, SVG2]) => {
  const byHash = new Map(svgs.map(svg => [sha256Hex(svg), svg]));
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const svg = [...byHash.entries()].find(([hash]) => url.includes(hash))?.[1];
    if (!url.includes('/v1/assets/') || svg == null) {
      throw new Error(`unexpected fetch ${url}`);
    }
    return { ok: true, status: 200, text: async () => svg } as Response;
  }) as typeof fetch;
};

// Documents of several versions at once, each served under its own number.
const serveVersions = (fixtures: Record<string, Fixture>) => {
  serveAssets();
  const bodyOf = (version: string, key: string) => {
    const body = fixtures[version]?.bodies.get(key);
    if (body == null) {
      throw new Error(`no fixture ${key} for ${version}`);
    }
    return body;
  };
  mockCourse.mockImplementation(async (_c, version) =>
    bodyOf(version, 'course'),
  );
  mockModule.mockImplementation(async (_c, version, moduleId) =>
    bodyOf(version, `modules/${moduleId}`),
  );
  mockLesson.mockImplementation(async (_c, version, lessonId) =>
    bodyOf(version, `lessons/${lessonId}`),
  );
};

const serveFixture = (fixture: Fixture) => {
  serveAssets();
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
      assetsBaseUrl: 'http://test/v1/assets',
    },
    course: {
      courseId: 'ca-class-c',
      schemaVersion: COURSE_SCHEMA_VERSION,
      latestVersion: BASE_VERSION,
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

// What a download leaves behind: the documents committed and every picture
// they show on the device. A check against an up-to-date course fetches
// pictures it finds missing, so a fixture without them would go to the
// network where the real thing would not.
const commitFixture = async (fixture: Fixture, version: string) => {
  await courseStore.commit(version, fixture.courseDoc, fixture.moduleDocs);
  await primeVectorsForTests([[sha256Hex(SVG), SVG]]);
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  courseStore.resetForTests();
  resetAssetsForTests();
  resetContentChannelForTests();
});

// The course the device starts every update test with — what a first
// download (installCourse) left behind.
const withBaseCourse = () => {
  beforeEach(async () => {
    await commitFixture(buildFixture(BASE_VERSION), BASE_VERSION);
  });
};

describe('runCourseUpdate (v2)', () => {
  withBaseCourse();

  it('reports offline when bootstrap is unreachable and touches nothing', async () => {
    mockBootstrap.mockRejectedValue(new Error('network'));
    const d = deps();
    const result = await runCourseUpdate(d);
    expect(result.status).toBe('offline');
    expect(mockCourse).not.toHaveBeenCalled();
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(BASE_VERSION);
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
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(BASE_VERSION);
  });

  it('refuses a manifest whose schemaVersion the app cannot parse', async () => {
    const fixture = buildFixture(NEXT_VERSION);
    serveFixture(fixture);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        schemaVersion: COURSE_SCHEMA_VERSION + 1,
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
    const snapshot = courseStore.getSnapshot()!;
    expect(snapshot.deliveryVersion).toBe(NEXT_VERSION);
    expect(snapshot.bundle.modules.map(m => m.moduleId)).toEqual([M1, M2]);
    // soft fallback: no resets, no prompt
    expect(d.resetLessons).toHaveBeenCalledWith([]);
    expect(d.resetTopics).toHaveBeenCalledWith([]);
    expect(await loadPrompt('u1')).toBeNull();
  });

  it('takes a withdrawn release back down when the server replaces wholesale', async () => {
    // The device holds a release that was later withdrawn, so the manifest no
    // longer places it and the server answers 'full' with an older latest.
    // Version ordering must not veto that: comparing would strand the device
    // on content nobody can reach any more.
    const withdrawn = buildFixture(LATER_VERSION);
    await commitFixture(withdrawn, LATER_VERSION);
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
    const result = await runCourseUpdate(deps());
    expect(result.status).toBe('updated');
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(NEXT_VERSION);
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
    const snapshot = courseStore.getSnapshot()!;
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
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(NEXT_VERSION);
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
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(NEXT_VERSION);
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
      versionAtReset = courseStore.getSnapshot()!.deliveryVersion;
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
      schemaVersion: COURSE_SCHEMA_VERSION,
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
      schemaVersion: COURSE_SCHEMA_VERSION,
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
        schemaVersion: COURSE_SCHEMA_VERSION,
        deliveryVersion: LATER_VERSION,
        lesson: orphanLesson,
        questions: [],
        assets: [],
      }),
    ).toThrow(/dangling question reference/);
  });
});

describe('opt-in course offers (v2)', () => {
  withBaseCourse();

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
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(NEXT_VERSION);
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
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(BASE_VERSION);
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
    const oldBundle = courseStore.getSnapshot()!.bundle;
    const oldLessonIds = oldBundle.modules.flatMap(module =>
      module.lessons.map(lesson => lesson.lessonId),
    );
    const oldModuleIds = oldBundle.modules.map(module => module.moduleId);

    const d = deps();
    const result = await acceptCourseOffer(d);

    expect(result.status).toBe('updated');
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(LATER_VERSION);
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
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(BASE_VERSION);
    expect(d.resetLessons).not.toHaveBeenCalled();
    expect(d.resetTopics).not.toHaveBeenCalled();
  });
});

describe('a device with no course', () => {
  it('runCourseUpdate has nothing to update and asks the server nothing', async () => {
    const result = await runCourseUpdate(deps());
    expect(result.status).toBe('no-course');
    expect(mockBootstrap).not.toHaveBeenCalled();
    expect(courseStore.getSnapshot()).toBeNull();
  });

  it('acceptCourseOffer refuses without a course on the device', async () => {
    const result = await acceptCourseOffer(deps());
    expect(result.status).toBe('no-course');
    expect(mockBootstrap).not.toHaveBeenCalled();
  });
});

describe('installCourse (first download)', () => {
  const fullBootstrap = (fixture: Fixture, version: string) =>
    bootstrapBody({
      latestVersion: version,
      mode: 'full',
      pendingVersions: [fixture.entry([{ op: 'full', severity: 'soft' }])],
      progressFallback: { severity: 'soft' },
    });

  // App.tsx renders the install gate on its own: no badge, no update manager,
  // no settings screen — so nothing else reads the stored channel off the
  // disk. The recovery download used to go to production whatever the
  // developer had chosen, and the only screen that could put that right sits
  // behind the course it was failing to download.
  it('waits for the stored channel before asking the server anything', async () => {
    await AsyncStorage.setItem('dmv-prep/dev-content-channel/v1', 'staging');
    resetContentChannelForTests();
    const fixture = buildFixture(NEXT_VERSION);
    serveFixture(fixture);
    const asked: string[] = [];
    mockBootstrap.mockImplementation(async () => {
      asked.push(getContentChannel());
      return fullBootstrap(fixture, NEXT_VERSION);
    });

    const result = await installCourse({ courseId: 'ca-class-c' });

    expect(result.status).toBe('installed');
    expect(asked).toEqual(['staging']);
  });

  it('asks for the latest without a version, fetches the whole course and commits it', async () => {
    const fixture = buildFixture(NEXT_VERSION);
    serveFixture(fixture);
    mockBootstrap.mockResolvedValue(fullBootstrap(fixture, NEXT_VERSION));
    const onProgress = jest.fn();

    const result = await installCourse({ courseId: 'ca-class-c', onProgress });

    expect(result.status).toBe('installed');
    // No local version to diff against: the bootstrap carries none.
    expect(mockBootstrap).toHaveBeenCalledWith('ca-class-c', null, '1.0.0');
    expect(mockCourse).toHaveBeenCalledWith('ca-class-c', NEXT_VERSION);
    expect(mockModule).toHaveBeenCalledTimes(2);
    expect(mockLesson).not.toHaveBeenCalled();
    const snapshot = courseStore.getSnapshot()!;
    expect(snapshot.deliveryVersion).toBe(NEXT_VERSION);
    expect(snapshot.bundle.modules.map(m => m.moduleId)).toEqual([M1, M2]);
    // Three documents and the one picture they share: a download is not done
    // until what it shows is on the device.
    expect(onProgress).toHaveBeenLastCalledWith({ fetched: 4, total: 4 });
    // A first download reconciles no progress: the seen cursor is untouched.
    expect(await AsyncStorage.getItem('dmv-prep/course-seen/v2/u1')).toBeNull();
  });

  it('downloads the whole course even when the server answers with a delta', async () => {
    // Nothing local means nothing to apply a delta to — every module comes
    // down, whatever the instructions say.
    const fixture = buildFixture(NEXT_VERSION);
    serveFixture(fixture);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: NEXT_VERSION,
        mode: 'delta',
        pendingVersions: [
          fixture.entry([
            { op: 'lesson-content', lessonId: L1, severity: 'soft' },
          ]),
        ],
      }),
    );

    const result = await installCourse({ courseId: 'ca-class-c' });

    expect(result.status).toBe('installed');
    expect(mockModule).toHaveBeenCalledTimes(2);
    expect(mockLesson).not.toHaveBeenCalled();
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(NEXT_VERSION);
  });

  it("lands in the course's own slot without switching the active course", async () => {
    const florida = buildFixture(NEXT_VERSION);
    florida.courseDoc.course.courseId = 'fl-class-e';
    florida.bodies.set('course', JSON.stringify(florida.courseDoc));
    serveFixture(florida);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        courseId: 'fl-class-e',
        latestVersion: NEXT_VERSION,
        mode: 'full',
        pendingVersions: [florida.entry([{ op: 'full', severity: 'soft' }])],
        progressFallback: { severity: 'soft' },
      }),
    );

    const result = await installCourse({ courseId: 'fl-class-e' });

    expect(result.status).toBe('installed');
    expect(mockCourse).toHaveBeenCalledWith('fl-class-e', NEXT_VERSION);
    expect(courseStore.activeCourseId()).toBe('ca-class-c');
    expect(courseStore.getSnapshot()).toBeNull();
    expect(courseStore.storedFor('fl-class-e')?.deliveryVersion).toBe(
      NEXT_VERSION,
    );
  });

  it('reports offline when the server is unreachable and commits nothing', async () => {
    mockBootstrap.mockRejectedValue(new Error('network'));
    const result = await installCourse({ courseId: 'ca-class-c' });
    expect(result.status).toBe('offline');
    expect(mockCourse).not.toHaveBeenCalled();
    expect(courseStore.getSnapshot()).toBeNull();
  });

  it('refuses when the app is below the version gate', async () => {
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
    const result = await installCourse({ courseId: 'ca-class-c' });
    expect(result.status).toBe('app-update-required');
    expect(mockCourse).not.toHaveBeenCalled();
    expect(courseStore.getSnapshot()).toBeNull();
  });

  it('commits nothing when a document fails verification', async () => {
    const fixture = buildFixture(NEXT_VERSION);
    const entry = fixture.entry([{ op: 'full', severity: 'soft' }]);
    // The manifest describes the intact bytes; the server delivers a
    // corrupted module.
    fixture.bodies.set(
      `modules/${M2}`,
      fixture.bodies.get(`modules/${M2}`)! + ' ',
    );
    serveFixture(fixture);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: NEXT_VERSION,
        mode: 'full',
        pendingVersions: [entry],
        progressFallback: { severity: 'soft' },
      }),
    );
    const result = await installCourse({ courseId: 'ca-class-c' });
    expect(result.status).toBe('failed');
    expect(courseStore.getSnapshot()).toBeNull();
    expect(
      await AsyncStorage.getItem('dmv-prep/course/v2/ca-class-c/meta'),
    ).toBeNull();
  });

  it('coalesces concurrent downloads of the same course', async () => {
    const fixture = buildFixture(NEXT_VERSION);
    serveFixture(fixture);
    mockBootstrap.mockResolvedValue(fullBootstrap(fixture, NEXT_VERSION));
    const [first, second] = await Promise.all([
      installCourse({ courseId: 'ca-class-c' }),
      installCourse({ courseId: 'ca-class-c' }),
    ]);
    expect(first.status).toBe('installed');
    expect(second.status).toBe('installed');
    expect(mockBootstrap).toHaveBeenCalledTimes(1);
    expect(mockModule).toHaveBeenCalledTimes(2);
  });

  it('the regular update pass picks up from an installed course', async () => {
    const installed = buildFixture(NEXT_VERSION);
    serveFixture(installed);
    mockBootstrap.mockResolvedValue(fullBootstrap(installed, NEXT_VERSION));
    expect((await installCourse({ courseId: 'ca-class-c' })).status).toBe(
      'installed',
    );

    const next = buildFixture(LATER_VERSION, { lessonTitle: 'Retitled' });
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
    expect(mockBootstrap).toHaveBeenLastCalledWith(
      'ca-class-c',
      NEXT_VERSION,
      '1.0.0',
    );
    expect(courseStore.getSnapshot()!.bundle.modules[0].lessons[0].title).toBe(
      'Retitled',
    );
  });
});

test('a module assembled from what the device holds is checked against the manifest', async () => {
  const base = buildFixture(BASE_VERSION);
  await commitFixture(base, BASE_VERSION);

  // The release says only lesson one changed. Module two is left out of every
  // instruction, so the device would carry it forward untouched — but the
  // manifest describes a module two that really did change. That is what an
  // instruction which failed to mention a change looks like from here, and
  // carrying it forward would leave the device on stale content believing it
  // was current.
  const fixture = buildFixture(NEXT_VERSION, {
    lessonTitle: 'Retitled lesson',
  });
  const movedOn = structuredClone(fixture.moduleDocs[1]);
  movedOn.module.title = 'Module two, rewritten';
  const movedOnBody = `${JSON.stringify(movedOn, null, 2)}\n`;

  const entry = fixture.entry([
    { op: 'lesson-content', lessonId: L1, severity: 'soft' },
  ]);
  entry.documents.modules[M2] = {
    sha256: sha256Hex(movedOnBody),
    sizeBytes: utf8ByteLength(movedOnBody),
  };

  serveFixture(fixture);
  const servedByFixture = mockModule.getMockImplementation()!;
  mockModule.mockImplementation(async (courseId, version, moduleId) =>
    moduleId === M2
      ? movedOnBody
      : servedByFixture(courseId, version, moduleId),
  );
  mockBootstrap.mockResolvedValue(
    bootstrapBody({
      latestVersion: NEXT_VERSION,
      mode: 'delta',
      pendingVersions: [entry],
    }),
  );

  const result = await runCourseUpdate(deps());

  expect(result.status).toBe('updated');
  // Lesson one came down as instructed; module two came down because what the
  // device assembled disagreed with the manifest.
  expect(mockLesson).toHaveBeenCalledWith('ca-class-c', NEXT_VERSION, L1);
  expect(mockModule).toHaveBeenCalledWith('ca-class-c', NEXT_VERSION, M2);
  const snapshot = courseStore.getSnapshot()!;
  expect(snapshot.deliveryVersion).toBe(NEXT_VERSION);
  expect(snapshot.bundle.modules[1].title).toBe('Module two, rewritten');
});

test('a picture that does not match its own hash keeps the version off the device', async () => {
  const base = buildFixture(BASE_VERSION);
  await commitFixture(base, BASE_VERSION);

  const fixture = buildFixture(NEXT_VERSION, {
    lessonTitle: 'Retitled lesson',
  });
  serveFixture(fixture);
  // The device does not hold the picture yet, so it has to come from the
  // server — which answers the asset route with something else. Documents are
  // verified against the manifest; artwork is verified the same way, and a
  // course whose pictures cannot be trusted is not a course to commit.
  await clearAssets();
  globalThis.fetch = (async () =>
    ({
      ok: true,
      status: 200,
      text: async () => '<svg xmlns="http://www.w3.org/2000/svg"><line/></svg>',
    } as Response)) as typeof fetch;
  mockBootstrap.mockResolvedValue(
    bootstrapBody({
      latestVersion: NEXT_VERSION,
      mode: 'full',
      pendingVersions: [fixture.entry([{ op: 'full', severity: 'soft' }])],
      progressFallback: { severity: 'soft' },
    }),
  );

  const result = await runCourseUpdate(deps());

  expect(result.status).toBe('failed');
  // Nothing committed: the device still holds what it had.
  expect(courseStore.getSnapshot()!.deliveryVersion).toBe(BASE_VERSION);
});

// ---------------------------------------------------------------------------
// What can go wrong on a phone, and what the device must be left with. The
// rule under every case: nothing lands until all of it has, and a run that
// dies leaves the course, the cursors and the pictures exactly as they were —
// so the next run can simply try again.

const seenOf = () => AsyncStorage.getItem('dmv-prep/course-seen/v2/u1');
const stagedKeysOf = async (version: string) =>
  (await AsyncStorage.getAllKeys()).filter(key => key.includes(`/${version}/`));

describe('an update that dies halfway', () => {
  withBaseCourse();

  const twoModules = (fixture: Fixture) =>
    bootstrapBody({
      latestVersion: NEXT_VERSION,
      mode: 'delta',
      pendingVersions: [
        fixture.entry([
          { op: 'module', moduleId: M1, severity: 'soft' },
          { op: 'module', moduleId: M2, severity: 'soft' },
        ]),
      ],
    });

  it('the connection drops on the second module: nothing lands, and the next run finishes the job', async () => {
    const fixture = buildFixture(NEXT_VERSION, { lessonTitle: 'Retitled' });
    serveFixture(fixture);
    mockModule
      .mockImplementationOnce(
        async (_c, _v, id) => fixture.bodies.get(`modules/${id}`)!,
      )
      .mockImplementationOnce(async () => {
        throw new TypeError('Network request failed');
      });
    mockBootstrap.mockResolvedValue(twoModules(fixture));

    const first = await runCourseUpdate(deps());
    expect(first.status).toBe('failed');
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(BASE_VERSION);
    expect(await seenOf()).toBe(BASE_VERSION);
    expect(await stagedKeysOf(NEXT_VERSION)).toEqual([]);

    // The network is back; the same run completes.
    const second = await runCourseUpdate(deps());
    expect(second.status).toBe('updated');
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(NEXT_VERSION);
    expect(await seenOf()).toBe(NEXT_VERSION);
  });

  it('the connection drops on the lesson of a patch: the old course stays whole', async () => {
    const fixture = buildFixture(NEXT_VERSION, { lessonTitle: 'Retitled' });
    serveFixture(fixture);
    mockLesson.mockRejectedValue(new TypeError('Network request failed'));
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: NEXT_VERSION,
        mode: 'delta',
        pendingVersions: [
          fixture.entry([
            { op: 'lesson-content', lessonId: L1, severity: 'soft' },
          ]),
        ],
      }),
    );

    const result = await runCourseUpdate(deps());
    expect(result.status).toBe('failed');
    const held = courseStore.getSnapshot()!;
    expect(held.deliveryVersion).toBe(BASE_VERSION);
    expect(held.bundle.modules[0].lessons[0].title).toBe(L1);
    expect(await seenOf()).toBe(BASE_VERSION);
  });

  it('the connection drops on one picture: the ones that arrived are kept, and only the rest is fetched next time', async () => {
    const fixture = buildFixture(NEXT_VERSION, {
      lessonTitle: 'Retitled',
      svgs: [SVG, SVG2],
    });
    serveFixture(fixture);
    const wanted = sha256Hex(SVG2);
    let refused = 0;
    const served = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(wanted) && refused === 0) {
        refused += 1;
        throw new TypeError('Network request failed');
      }
      return {
        ok: true,
        status: 200,
        text: async () => (url.includes(wanted) ? SVG2 : SVG),
      } as Response;
    });
    globalThis.fetch = served as unknown as typeof fetch;
    mockBootstrap.mockResolvedValue(twoModules(fixture));

    // SVG is already on the device (the base course shows it); SVG2 is new
    // and its download dies — once and then again on the retry.
    served.mockImplementationOnce(async () => {
      throw new TypeError('Network request failed');
    });
    const first = await runCourseUpdate(deps());
    expect(first.status).toBe('failed');
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(BASE_VERSION);
    expect(vectorMarkup(fixture.moduleDocs[1].assets[0])).toBeNull();

    const second = await runCourseUpdate(deps());
    expect(second.status).toBe('updated');
    expect(vectorMarkup(fixture.moduleDocs[1].assets[0])).toBe(SVG2);
  });

  it('storage refuses the commit: nothing lands, the old course stays', async () => {
    const fixture = buildFixture(NEXT_VERSION, { lessonTitle: 'Retitled' });
    serveFixture(fixture);
    mockBootstrap.mockResolvedValue(twoModules(fixture));
    (AsyncStorage.setMany as jest.Mock).mockRejectedValueOnce(
      new Error('disk full'),
    );

    const first = await runCourseUpdate(deps());
    expect(first.status).toBe('failed');
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(BASE_VERSION);
    expect(await stagedKeysOf(NEXT_VERSION)).toEqual([]);

    const second = await runCourseUpdate(deps());
    expect(second.status).toBe('updated');
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(NEXT_VERSION);
  });

  it('a kill after the documents were staged but before the pointer moved leaves the old version live', async () => {
    const fixture = buildFixture(NEXT_VERSION, { lessonTitle: 'Retitled' });
    serveFixture(fixture);
    mockBootstrap.mockResolvedValue(twoModules(fixture));
    const metaKey = 'dmv-prep/course/v2/ca-class-c/meta';
    const realSetItem = AsyncStorage.setItem as jest.Mock;
    const original = realSetItem.getMockImplementation()!;
    realSetItem.mockImplementation((key: string, value: string) => {
      if (key === metaKey && value.includes(NEXT_VERSION)) {
        // The process is gone before this write.
        return Promise.reject(new Error('killed'));
      }
      return original(key, value);
    });

    const result = await runCourseUpdate(deps());
    expect(result.status).toBe('failed');
    realSetItem.mockImplementation(original);

    // Next launch: the pointer still names the old version, whose documents
    // are all there; what was staged for the new one is swept.
    courseStore.resetForTests();
    await courseStore.hydrate();
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(BASE_VERSION);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(await stagedKeysOf(NEXT_VERSION)).toEqual([]);
  });

  it('the pointer is corrupt on the next launch: the store serves nothing and the download starts over', async () => {
    await AsyncStorage.setItem(
      'dmv-prep/course/v2/ca-class-c/meta',
      '{not json',
    );
    courseStore.resetForTests();
    await courseStore.hydrate();
    expect(courseStore.getSnapshot()).toBeNull();
    // What the gate does next.
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
    const result = await installCourse({ courseId: 'ca-class-c' });
    expect(result.status).toBe('installed');
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(NEXT_VERSION);
  });

  it('the server rolls back while the device downloads: nothing lands, and the next check takes the rollback whole', async () => {
    const fixture = buildFixture(NEXT_VERSION, { lessonTitle: 'Retitled' });
    serveFixture(fixture);
    // The version was withdrawn mid-download: its documents are gone.
    mockModule.mockRejectedValue(
      new Error('content server responded 404 for modules'),
    );
    mockBootstrap.mockResolvedValue(twoModules(fixture));
    const first = await runCourseUpdate(deps());
    expect(first.status).toBe('failed');
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(BASE_VERSION);

    // The channel now points below where the device is — it is told to take
    // the current version whole, which is the one it already holds.
    const base = buildFixture(BASE_VERSION);
    serveFixture(base);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: BASE_VERSION,
        mode: 'full',
        pendingVersions: [base.entry([{ op: 'full', severity: 'soft' }])],
        progressFallback: { severity: 'soft' },
      }),
    );
    const second = await runCourseUpdate(deps());
    expect(second.status).toBe('updated');
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(BASE_VERSION);
  });
});

describe('an old build under a raised minAppVersion', () => {
  withBaseCourse();

  it('takes every version under the raise and asks for the app update alongside', async () => {
    const v2 = buildFixture(NEXT_VERSION, { lessonTitle: 'Retitled' });
    const v3 = buildFixture(LATER_VERSION, { lessonTitle: 'Retitled again' });
    serveVersions({ [NEXT_VERSION]: v2, [LATER_VERSION]: v3 });
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: LATER_VERSION,
        mode: 'delta',
        pendingVersions: [
          v2.entry([{ op: 'module', moduleId: M1, severity: 'soft' }]),
          {
            ...v3.entry([{ op: 'module', moduleId: M1, severity: 'soft' }]),
            minAppVersion: '9.0.0',
          },
        ],
      }),
    );

    const result = await runCourseUpdate(deps());
    expect(result.status).toBe('updated');
    expect(result.appUpdateRequired).toBe(true);
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(NEXT_VERSION);
    expect(await seenOf()).toBe(NEXT_VERSION);
    // Nothing of the version this build cannot take was asked for.
    expect(mockModule.mock.calls.every(call => call[1] === NEXT_VERSION)).toBe(
      true,
    );
    expect(mockCourse).not.toHaveBeenCalledWith('ca-class-c', LATER_VERSION);
  });

  it('refuses when the very next version already needs a newer app', async () => {
    const v2 = buildFixture(NEXT_VERSION, { lessonTitle: 'Retitled' });
    serveFixture(v2);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: NEXT_VERSION,
        mode: 'delta',
        pendingVersions: [
          {
            ...v2.entry([{ op: 'module', moduleId: M1, severity: 'soft' }]),
            minAppVersion: '9.0.0',
          },
        ],
      }),
    );
    const result = await runCourseUpdate(deps());
    expect(result.status).toBe('app-update-required');
    expect(mockCourse).not.toHaveBeenCalled();
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(BASE_VERSION);
  });

  it('takes the versions under the raise again on the next launch without asking twice for what it has', async () => {
    // After the run above the device sits on NEXT with LATER still withheld:
    // the next check must not re-download NEXT.
    const v2 = buildFixture(NEXT_VERSION, { lessonTitle: 'Retitled' });
    await commitFixture(v2, NEXT_VERSION);
    await AsyncStorage.setItem('dmv-prep/course-seen/v2/u1', NEXT_VERSION);
    const v3 = buildFixture(LATER_VERSION, { lessonTitle: 'Retitled again' });
    serveVersions({ [LATER_VERSION]: v3 });
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: LATER_VERSION,
        mode: 'delta',
        pendingVersions: [
          {
            ...v3.entry([{ op: 'module', moduleId: M1, severity: 'soft' }]),
            minAppVersion: '9.0.0',
          },
        ],
      }),
    );
    const result = await runCourseUpdate(deps());
    expect(result.status).toBe('app-update-required');
    expect(mockCourse).not.toHaveBeenCalled();
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(NEXT_VERSION);
  });
});

describe('pictures that go missing on the device', () => {
  withBaseCourse();

  it('are fetched again on the next check, without a new version', async () => {
    await clearAssets();
    serveAssets();
    mockBootstrap.mockResolvedValue(bootstrapBody());
    const result = await runCourseUpdate(deps());
    expect(result.status).toBe('up-to-date');
    const asset = courseStore.getSnapshot()!.bundle.assets[0];
    expect(vectorMarkup(asset)).toBe(SVG);
  });

  it('and a check that cannot fetch them is still a check', async () => {
    await clearAssets();
    globalThis.fetch = (async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    mockBootstrap.mockResolvedValue(bootstrapBody());
    const result = await runCourseUpdate(deps());
    expect(result.status).toBe('up-to-date');
    expect(courseStore.getSnapshot()!.deliveryVersion).toBe(BASE_VERSION);
  });
});

describe('two states on one device', () => {
  withBaseCourse();

  it("installing a second course keeps the first course's pictures", async () => {
    const florida = buildFixture(NEXT_VERSION, {
      courseId: 'fl-class-e',
      svgs: [SVG2, SVG2],
    });
    serveFixture(florida);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        courseId: 'fl-class-e',
        latestVersion: NEXT_VERSION,
        mode: 'full',
        pendingVersions: [florida.entry([{ op: 'full', severity: 'soft' }])],
        progressFallback: { severity: 'soft' },
      }),
    );
    const result = await installCourse({ courseId: 'fl-class-e' });
    expect(result.status).toBe('installed');
    // Florida's picture arrived, and California's is still there.
    expect(vectorMarkup(florida.moduleDocs[0].assets[0])).toBe(SVG2);
    expect(
      await AsyncStorage.getItem(`dmv-prep/assets/v1/${sha256Hex(SVG)}`),
    ).toBe(SVG);
  });
});

describe('a course on the device is a course that works on a plane', () => {
  it('after installing, every picture is there and draws with the network gone', async () => {
    const fixture = buildFixture(NEXT_VERSION, { svgs: [SVG, SVG2] });
    serveFixture(fixture);
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: NEXT_VERSION,
        mode: 'full',
        pendingVersions: [fixture.entry([{ op: 'full', severity: 'soft' }])],
        progressFallback: { severity: 'soft' },
      }),
    );

    const result = await installCourse({ courseId: 'ca-class-c' });
    expect(result.status).toBe('installed');

    const held = courseStore.getSnapshot()!;
    // Everything the course shows came down with it.
    expect(await missingAssets(held.bundle.assets)).toEqual([]);

    // The phone is restarted in a tunnel: memory is gone, and nothing can be
    // fetched. The launch reads what the course shows off the device.
    resetAssetsForTests();
    courseStore.resetForTests();
    globalThis.fetch = (async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    await courseStore.hydrate();
    const offline = courseStore.getSnapshot()!;
    expect(offline.deliveryVersion).toBe(NEXT_VERSION);
    await warmAssets(offline.bundle.assets.map(asset => asset.sha256));

    // Every illustration the course holds is drawable, with no waiting.
    for (const asset of offline.bundle.assets) {
      expect(assetSource(asset)).not.toBeNull();
    }
    // And the lessons themselves are all there.
    expect(
      offline.bundle.modules.flatMap(module => module.lessons),
    ).toHaveLength(2);
  });

  it('a picture that cannot be fetched keeps the version off the device entirely', async () => {
    const fixture = buildFixture(NEXT_VERSION, { svgs: [SVG, SVG2] });
    serveFixture(fixture);
    await clearAssets();
    // One of the two pictures never arrives.
    const wanted = sha256Hex(SVG2);
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).includes(wanted)) {
        throw new TypeError('Network request failed');
      }
      return { ok: true, status: 200, text: async () => SVG } as Response;
    }) as typeof fetch;
    mockBootstrap.mockResolvedValue(
      bootstrapBody({
        latestVersion: NEXT_VERSION,
        mode: 'full',
        pendingVersions: [fixture.entry([{ op: 'full', severity: 'soft' }])],
        progressFallback: { severity: 'soft' },
      }),
    );

    const result = await installCourse({ courseId: 'ca-class-c' });
    expect(result.status).toBe('failed');
    // Half a course is no course: nothing was committed.
    expect(courseStore.getSnapshot()).toBeNull();
  });
});
