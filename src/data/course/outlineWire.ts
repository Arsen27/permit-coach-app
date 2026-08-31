// The outline the server serves under the lazy model: every lesson's name,
// description, question ids and document hash — no bodies, no pictures. The
// app validates it defensively; a malformed answer is refused whole rather
// than rendered half-empty.

export type OutlineDocRef = { sha256: string; sizeBytes: number };

export type OutlineLessonV1 = {
  lessonId: string;
  title: string;
  objective: string;
  estimatedMinutes: string;
  cardCount: number;
  questionCount: number;
  questionIds: string[];
  theoryQuestionIds?: string[];
  testQuestionIds?: string[];
  doc: OutlineDocRef;
};

export type OutlineModuleV1 = {
  moduleId: string;
  title: string;
  sequence: number;
  moduleTestQuestionCount: number;
  moduleTestQuestionIds: string[];
  lessons: OutlineLessonV1[];
};

export type CourseOutlineV1 = {
  courseId: string;
  version: string;
  title: string;
  state: string;
  modules: OutlineModuleV1[];
};

export type OutlineValidation =
  | { ok: true; value: CourseOutlineV1; errors: [] }
  | { ok: false; value: null; errors: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const SHA256 = /^[0-9a-f]{64}$/;

const strOf = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const idsOf = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every(item => typeof item === 'string')
    ? (value as string[])
    : null;

export const validateCourseOutline = (input: unknown): OutlineValidation => {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { ok: false, value: null, errors: ['outline: expected object'] };
  }
  const courseId = strOf(input.courseId);
  const version = strOf(input.version);
  const title = strOf(input.title);
  const state = strOf(input.state);
  if (courseId == null || version == null || title == null || state == null) {
    errors.push('outline: courseId, version, title and state are required');
  }
  if (!Array.isArray(input.modules) || input.modules.length === 0) {
    return {
      ok: false,
      value: null,
      errors: [...errors, 'outline.modules: expected a non-empty array'],
    };
  }
  const modules: OutlineModuleV1[] = [];
  input.modules.forEach((moduleRaw, moduleIndex) => {
    if (!isRecord(moduleRaw)) {
      errors.push(`outline.modules[${moduleIndex}]: expected object`);
      return;
    }
    const moduleId = strOf(moduleRaw.moduleId);
    const moduleTitle = strOf(moduleRaw.title);
    const testIds = idsOf(moduleRaw.moduleTestQuestionIds);
    if (moduleId == null || moduleTitle == null || testIds == null) {
      errors.push(`outline.modules[${moduleIndex}]: malformed module`);
      return;
    }
    if (!Array.isArray(moduleRaw.lessons)) {
      errors.push(`outline.modules[${moduleIndex}].lessons: expected array`);
      return;
    }
    const lessons: OutlineLessonV1[] = [];
    moduleRaw.lessons.forEach((lessonRaw, lessonIndex) => {
      const where = `outline.modules[${moduleIndex}].lessons[${lessonIndex}]`;
      if (!isRecord(lessonRaw)) {
        errors.push(`${where}: expected object`);
        return;
      }
      const lessonId = strOf(lessonRaw.lessonId);
      const lessonTitle = strOf(lessonRaw.title);
      const questionIds = idsOf(lessonRaw.questionIds);
      const doc = lessonRaw.doc;
      if (
        lessonId == null ||
        lessonTitle == null ||
        questionIds == null ||
        !isRecord(doc) ||
        typeof doc.sha256 !== 'string' ||
        !SHA256.test(doc.sha256) ||
        typeof doc.sizeBytes !== 'number' ||
        doc.sizeBytes <= 0
      ) {
        errors.push(`${where}: malformed lesson`);
        return;
      }
      lessons.push({
        lessonId,
        title: lessonTitle,
        objective:
          typeof lessonRaw.objective === 'string' ? lessonRaw.objective : '',
        estimatedMinutes:
          typeof lessonRaw.estimatedMinutes === 'string'
            ? lessonRaw.estimatedMinutes
            : '',
        cardCount:
          typeof lessonRaw.cardCount === 'number' ? lessonRaw.cardCount : 0,
        questionCount:
          typeof lessonRaw.questionCount === 'number'
            ? lessonRaw.questionCount
            : questionIds.length,
        questionIds,
        ...(idsOf(lessonRaw.theoryQuestionIds) != null && {
          theoryQuestionIds: idsOf(lessonRaw.theoryQuestionIds)!,
        }),
        ...(idsOf(lessonRaw.testQuestionIds) != null && {
          testQuestionIds: idsOf(lessonRaw.testQuestionIds)!,
        }),
        doc: { sha256: doc.sha256, sizeBytes: doc.sizeBytes },
      });
    });
    modules.push({
      moduleId,
      title: moduleTitle,
      sequence:
        typeof moduleRaw.sequence === 'number'
          ? moduleRaw.sequence
          : moduleIndex + 1,
      moduleTestQuestionCount: testIds.length,
      moduleTestQuestionIds: testIds,
      lessons,
    });
  });
  if (errors.length > 0) {
    return { ok: false, value: null, errors };
  }
  return {
    ok: true,
    value: {
      courseId: courseId!,
      version: version!,
      title: title!,
      state: state!,
      modules,
    },
    errors: [],
  };
};
