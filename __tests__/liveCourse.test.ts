import AsyncStorage from '@react-native-async-storage/async-storage';

import { resetAssetsForTests } from '@/data/assets/store';
import {
  ensureLesson,
  hydrateLazyCourse,
  lazySnapshot,
  lessonLoaded,
  resetLazyForTests,
  syncLazyCourse,
} from '@/data/course/lazy';
import {
  courseLessonQuiz,
  courseModuleTestQuiz,
  findCourseQuizQuestion,
} from '@/data/course/learn';
import { courseStore } from '@/data/course/store';
import { resetContentChannelForTests } from '@/lib/contentChannel';

// The real thing: the lazy model against the content server that ships, with
// nothing mocked but the phone's storage. Opt-in — it needs the network:
//
//   LIVE_SERVER=1 npx jest __tests__/liveCourse.test.ts
//
// One sync must make a working course out of the outline and the bank; a
// lesson must arrive verified when opened and stay; and the quizzes must
// resolve every question from the bank — for lessons never opened at all.

const live = process.env.LIVE_SERVER === '1' ? describe : describe.skip;

const COURSE = 'ca-class-c';

const deps = () => ({
  userId: 'live',
  courseId: COURSE,
  completedLessonIds: [] as string[],
});

live('the lazy model against the live content server', () => {
  jest.setTimeout(240000);

  beforeEach(async () => {
    await AsyncStorage.clear();
    courseStore.resetForTests();
    resetLazyForTests();
    resetAssetsForTests();
    resetContentChannelForTests();
  });

  it('one sync makes a working course; a lesson arrives when opened and stays', async () => {
    const first = await syncLazyCourse(deps());
    expect(first.status).toBe('ready');

    const held = lazySnapshot(COURSE)!;
    expect(held.bundle.modules.length).toBeGreaterThan(0);
    // The bank answers for every lesson, opened or not.
    expect(held.bundle.questions.length).toBeGreaterThan(100);
    const lesson = held.bundle.modules[0].lessons[0];
    expect(lesson.blocks).toHaveLength(0);
    expect(courseLessonQuiz(lesson.lessonId).length).toBeGreaterThan(0);
    expect(
      courseModuleTestQuiz(held.bundle.modules[0].moduleId).length,
    ).toBeGreaterThan(0);
    for (const id of lesson.questionIds) {
      expect(findCourseQuizQuestion(id)).toBeDefined();
    }

    // Opening the lesson brings its slides, hash-verified.
    expect(await ensureLesson(COURSE, lesson.lessonId)).toBe('ready');
    const loaded = lazySnapshot(COURSE)!.bundle.modules[0].lessons[0];
    expect(loaded.blocks.length).toBeGreaterThan(0);

    // A restart keeps it, with no network at all.
    resetLazyForTests();
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    try {
      await hydrateLazyCourse(COURSE);
      expect(lessonLoaded(COURSE, lesson.lessonId)).toBe(true);
      expect(await ensureLesson(COURSE, lesson.lessonId)).toBe('ready');
    } finally {
      globalThis.fetch = realFetch;
    }

    // And a second sync moves nothing.
    const second = await syncLazyCourse(deps());
    expect(second.status).toBe('ready');
    expect(lazySnapshot(COURSE)!.deliveryVersion).toBe(held.deliveryVersion);
  });
});
