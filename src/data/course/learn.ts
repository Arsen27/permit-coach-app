// Learner-facing selectors over the current course. Backed by the device
// course store: indexes rebuild whenever a new course version is committed
// (identity-memoized on the bundle reference). React components that must
// re-render on commit subscribe via useCourse() from ./CourseProvider.

import { QuizQuestion } from '@/data/curriculum';

import { toQuizQuestion } from './adapters';
import { courseStore } from './store';
import type {
  CourseAssetV2,
  CourseBundleV2,
  CourseLessonV2,
  CourseModuleV2,
  CourseQuestionV2,
} from './v2/wire';

export type CourseLessonRef = {
  lesson: CourseLessonV2;
  module: CourseModuleV2;
};

type DerivedIndexes = {
  lessonRefs: CourseLessonRef[];
  lessonRefById: Map<string, CourseLessonRef>;
  lessonNumberById: Map<string, number>;
  questionById: Map<string, CourseQuestionV2>;
  assetById: Map<string, CourseAssetV2>;
};

let indexedBundle: CourseBundleV2 | null = null;
let indexes: DerivedIndexes = {
  lessonRefs: [],
  lessonRefById: new Map(),
  lessonNumberById: new Map(),
  questionById: new Map(),
  assetById: new Map(),
};

const derived = (): DerivedIndexes => {
  const bundle = courseStore.getSnapshot().bundle;
  if (bundle !== indexedBundle) {
    const lessonRefs = bundle.modules.flatMap(module =>
      module.lessons.map(lesson => ({ lesson, module })),
    );
    indexes = {
      lessonRefs,
      lessonRefById: new Map(lessonRefs.map(ref => [ref.lesson.lessonId, ref])),
      lessonNumberById: new Map(
        lessonRefs.map((ref, index) => [ref.lesson.lessonId, index + 1]),
      ),
      questionById: new Map(
        bundle.questions.map(question => [question.questionId, question]),
      ),
      assetById: new Map(bundle.assets.map(asset => [asset.assetId, asset])),
    };
    indexedBundle = bundle;
  }
  return indexes;
};

export const courseModules = (): CourseModuleV2[] =>
  courseStore.getSnapshot().bundle.modules;

export const courseQuestionIds = (): string[] =>
  courseStore
    .getSnapshot()
    .bundle.questions.map(question => question.questionId);

// Course order, across module boundaries — drives the "continue here" marker.
export const orderedCourseLessons = (): CourseLessonRef[] =>
  derived().lessonRefs;

export const courseLessonCount = (): number => derived().lessonRefs.length;

export const findCourseLesson = (
  lessonId: string,
): CourseLessonRef | undefined => derived().lessonRefById.get(lessonId);

// Course-wide 1-based lesson number, shown in the UI instead of the
// per-module `moduleSequence`.
export const courseLessonNumber = (lessonId: string): number =>
  derived().lessonNumberById.get(lessonId) ?? 0;

export const findCourseQuestion = (
  questionId: string,
): CourseQuestionV2 | undefined => derived().questionById.get(questionId);

export const findCourseAsset = (assetId: string): CourseAssetV2 | undefined =>
  derived().assetById.get(assetId);

export const courseModuleTestQuiz = (moduleId: string): QuizQuestion[] => {
  const module = courseModules().find(entry => entry.moduleId === moduleId);
  if (module == null) {
    return [];
  }
  return module.moduleTest.questionIds.flatMap(id => {
    const question = derived().questionById.get(id);
    return question ? [toQuizQuestion(question)] : [];
  });
};

export const courseLessonQuiz = (lessonId: string): QuizQuestion[] => {
  const lesson = derived().lessonRefById.get(lessonId)?.lesson;
  if (lesson == null) {
    return [];
  }
  return (lesson.testQuestionIds ?? lesson.questionIds).flatMap(id => {
    const question = derived().questionById.get(id);
    return question ? [toQuizQuestion(question)] : [];
  });
};

export const findCourseQuizQuestion = (
  questionId: string,
): QuizQuestion | undefined => {
  const question = derived().questionById.get(questionId);
  return question ? toQuizQuestion(question) : undefined;
};
