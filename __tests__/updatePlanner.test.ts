import { planContentFetch, planProgressActions } from '@/data/course/planner';
import type {
  CourseBundleV2,
  CourseLessonV2,
  UpdateInstructionV2,
} from '@/data/course/v2/wire';

// v2 stable ids are flat slugs — module ids and lesson ids share only the
// course prefix `ca-`; practice topics (road-signs, …) have no prefix.
const M1 = 'ca-read-the-road';
const M2 = 'ca-intersections';
const L11 = 'ca-sign-shapes';
const L12 = 'ca-regulatory-signs';
const L21 = 'ca-uncontrolled';

const lesson = (lessonId: string, moduleId: string): CourseLessonV2 => ({
  lessonId,
  uuid: `00000000-0000-5000-8000-00000000000f`,
  moduleId,
  globalSequence: 1,
  moduleSequence: 1,
  title: lessonId,
  objective: 'o',
  estimatedMinutes: '5-7',
  format: 'scenario_first_cards',
  blocks: [],
  questionIds: [],
  assetIds: [],
  language: 'en-US',
});

const bundle: CourseBundleV2 = {
  course: {
    courseId: 'ca-class-c',
    title: 't',
    subtitle: 's',
    jurisdiction: 'CA',
    state: 'California',
    language: 'en-US',
    targetLicense: 'x',
    moduleIds: [M1, M2],
    sourceVersionLabel: 'v',
    sourceContentHash: 'h',
    sourceCheckedAt: 'd',
    sourceReviewStatus: 's',
    publicationAuthorized: false,
  },
  modules: [
    {
      moduleId: M1,
      uuid: '00000000-0000-5000-8000-0000000000aa',
      sequence: 1,
      title: 'm1',
      outcome: '',
      lessons: [lesson(L11, M1), lesson(L12, M1)],
      moduleTest: {
        testId: `${M1}-test`,
        uuid: '00000000-0000-5000-8000-0000000000ab',
        moduleId: M1,
        questionIds: [],
      },
    },
    {
      moduleId: M2,
      uuid: '00000000-0000-5000-8000-0000000000ac',
      sequence: 2,
      title: 'm2',
      outcome: '',
      lessons: [lesson(L21, M2)],
      moduleTest: {
        testId: `${M2}-test`,
        uuid: '00000000-0000-5000-8000-0000000000ad',
        moduleId: M2,
        questionIds: [],
      },
    },
  ],
  questions: [],
  assets: [],
};

const lessonOwner = new Map<string, string>([
  [L11, M1],
  [L12, M1],
  [L21, M2],
]);

describe('planContentFetch', () => {
  // A release that changed only the course document — a slide type, its glyph,
  // the course title — carries no instruction, because there is no lesson or
  // module to name. The client still bumps its version and still fetches
  // course.json (it always does), and this is what makes that cheap: nothing
  // else is downloaded, and every module is carried forward from the device.
  it('plans no downloads for a release that carries no instructions', () => {
    expect(planContentFetch([], lessonOwner)).toEqual({
      full: false,
      moduleIds: [],
      lessonIds: [],
    });
  });

  it('maps lesson-level ops to single LessonDoc fetches', () => {
    const plan = planContentFetch(
      [
        { op: 'lesson-content', lessonId: L11, severity: 'soft' },
        { op: 'lesson-questions', lessonId: L21, severity: 'soft' },
      ],
      lessonOwner,
    );
    expect(plan).toEqual({ full: false, moduleIds: [], lessonIds: [L11, L21] });
  });

  it('maps a lesson-owned question op to that LessonDoc', () => {
    const plan = planContentFetch(
      [{ op: 'question', questionId: 'q', lessonId: L12, severity: 'soft' }],
      lessonOwner,
    );
    expect(plan).toEqual({ full: false, moduleIds: [], lessonIds: [L12] });
  });

  it('maps a module-test question op to the ModuleDoc', () => {
    const plan = planContentFetch(
      [{ op: 'question', questionId: 'q', moduleId: M1, severity: 'soft' }],
      lessonOwner,
    );
    expect(plan).toEqual({ full: false, moduleIds: [M1], lessonIds: [] });
  });

  it('maps a module op to the ModuleDoc and absorbs its lesson ops', () => {
    const plan = planContentFetch(
      [
        { op: 'module', moduleId: M1, severity: 'soft' },
        { op: 'lesson-content', lessonId: L11, severity: 'soft' },
        { op: 'lesson-content', lessonId: L21, severity: 'soft' },
      ],
      lessonOwner,
    );
    expect(plan).toEqual({ full: false, moduleIds: [M1], lessonIds: [L21] });
  });

  it('compacts instructions from multiple pending versions without duplicates', () => {
    const plan = planContentFetch(
      [
        { op: 'lesson-content', lessonId: L11, severity: 'soft' },
        { op: 'lesson-questions', lessonId: L11, severity: 'optional' },
        { op: 'question', questionId: 'q', lessonId: L11, severity: 'soft' },
      ],
      lessonOwner,
    );
    expect(plan).toEqual({ full: false, moduleIds: [], lessonIds: [L11] });
  });

  it('escalates to a full fetch on a full op or an unknown op', () => {
    expect(
      planContentFetch([{ op: 'full', severity: 'soft' }], lessonOwner),
    ).toEqual({ full: true, moduleIds: [], lessonIds: [] });
    expect(
      planContentFetch(
        [
          {
            op: 'rewrite-everything',
            severity: 'soft',
          } as unknown as UpdateInstructionV2,
        ],
        lessonOwner,
      ),
    ).toEqual({ full: true, moduleIds: [], lessonIds: [] });
  });

  it('keeps a lesson unknown to the device in lessonIds for the updater to resolve', () => {
    const plan = planContentFetch(
      [
        { op: 'module', moduleId: M1, severity: 'soft' },
        { op: 'lesson-content', lessonId: 'ca-brand-new', severity: 'soft' },
      ],
      lessonOwner,
    );
    expect(plan.lessonIds).toEqual(['ca-brand-new']);
  });
});

const progress = {
  lessonIds: [L11, L21],
  topicIds: [M1, 'road-signs'],
};

describe('planProgressActions', () => {
  it('soft instructions never touch progress or produce a prompt', () => {
    const plan = planProgressActions(
      'u1',
      [{ op: 'full', severity: 'soft' }],
      progress,
      bundle,
    );
    expect(plan.hardResets).toEqual({ lessonIds: [], topicIds: [] });
    expect(plan.prompt).toBeNull();
  });

  it('hard lesson op resets only that started lesson', () => {
    const plan = planProgressActions(
      'u1',
      [{ op: 'lesson-content', lessonId: L11, severity: 'hard', message: 'm' }],
      progress,
      bundle,
    );
    expect(plan.hardResets).toEqual({ lessonIds: [L11], topicIds: [] });
    expect(plan.prompt?.kind).toBe('hard');
    expect(plan.prompt?.message).toBe('m');
  });

  it('stays silent for hard ops on scopes the user never started', () => {
    const plan = planProgressActions(
      'u1',
      [{ op: 'lesson-content', lessonId: L12, severity: 'hard' }],
      progress,
      bundle,
    );
    expect(plan.hardResets).toEqual({ lessonIds: [], topicIds: [] });
    expect(plan.prompt).toBeNull();
  });

  it('module scope resolves lessons through the new bundle structure', () => {
    const plan = planProgressActions(
      'u1',
      [{ op: 'module', moduleId: M1, severity: 'hard' }],
      progress,
      bundle,
    );
    expect(plan.hardResets).toEqual({ lessonIds: [L11], topicIds: [M1] });
  });

  it('module-test question op resets only the module topic score', () => {
    const plan = planProgressActions(
      'u1',
      [{ op: 'question', questionId: 'q', moduleId: M1, severity: 'hard' }],
      progress,
      bundle,
    );
    expect(plan.hardResets).toEqual({ lessonIds: [], topicIds: [M1] });
  });

  it('full scope hits only course-prefixed keys, sparing practice topics', () => {
    const plan = planProgressActions(
      'u1',
      [{ op: 'full', severity: 'hard' }],
      progress,
      bundle,
    );
    expect(plan.hardResets).toEqual({
      lessonIds: [L11, L21],
      topicIds: [M1],
    });
  });

  it('optional scopes aggregate into one keep-or-redo prompt, no resets', () => {
    const plan = planProgressActions(
      'u1',
      [
        { op: 'lesson-content', lessonId: L11, severity: 'optional' },
        { op: 'question', questionId: 'q', moduleId: M1, severity: 'optional' },
      ],
      progress,
      bundle,
    );
    expect(plan.hardResets).toEqual({ lessonIds: [], topicIds: [] });
    expect(plan.prompt?.kind).toBe('optional');
    expect(plan.prompt?.optionalReset).toEqual({
      lessonIds: [L11],
      topicIds: [M1],
    });
  });

  it('any hard scope wins over optional scopes in the same pass', () => {
    const plan = planProgressActions(
      'u1',
      [
        { op: 'lesson-content', lessonId: L21, severity: 'optional' },
        { op: 'lesson-content', lessonId: L11, severity: 'hard' },
      ],
      progress,
      bundle,
    );
    expect(plan.prompt?.kind).toBe('hard');
    expect(plan.hardResets.lessonIds).toEqual([L11]);
    // Optional scope keeps its progress when a hard prompt is shown.
    expect(plan.prompt?.optionalReset).toEqual({ lessonIds: [], topicIds: [] });
  });

  it('skips instructions with an unknown severity', () => {
    const plan = planProgressActions(
      'u1',
      [
        {
          op: 'lesson-content',
          lessonId: L11,
          severity: 'catastrophic',
        } as unknown as UpdateInstructionV2,
      ],
      progress,
      bundle,
    );
    expect(plan.hardResets).toEqual({ lessonIds: [], topicIds: [] });
    expect(plan.prompt).toBeNull();
  });
});
