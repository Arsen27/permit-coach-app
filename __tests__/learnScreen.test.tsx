import React from 'react';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import { clearMark, primeMarksForTests } from '@/data/course/lazy';
import { courseStore } from '@/data/course/store';
import { resetDevUnlockAllForTests, setDevUnlockAll } from '@/lib/devUnlock';
import LearnScreen from '@/screens/LearnScreen';
import { AppStateProvider, useAppState } from '@/state/AppState';
import { defaultTheme } from '@/theme';

import {
  FIXTURE_COURSE_BUNDLE,
  commitFixtureCourse,
} from './fixtures/courseFixture';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

let observedState: ReturnType<typeof useAppState> | null = null;
const Probe: React.FC = () => {
  observedState = useAppState();
  return null;
};

const renderLearn = async (): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <AppStateProvider userId="test-user">
          <Probe />
          <LearnScreen />
        </AppStateProvider>
      </ThemeProvider>,
    );
  });
  return tree;
};

const textsOf = (tree: Renderer): string[] =>
  tree.root
    .findAll(node => String(node.type) === 'Text' && node.children.length > 0)
    .map(node =>
      node.children
        .map(child => (typeof child === 'string' ? child : ''))
        .join(''),
    );

const pressByText = async (tree: Renderer, text: string): Promise<void> => {
  const seen = new Set<unknown>();
  const targets = tree.root
    .findAll(node => {
      if (typeof node.props.onPress !== 'function' || node.props.disabled) {
        return false;
      }
      return node
        .findAll(inner => String(inner.type) === 'Text')
        .some(inner =>
          inner.children.some(
            child => typeof child === 'string' && child === text,
          ),
        );
    })
    .filter(node => {
      if (seen.has(node.props.onPress)) {
        return false;
      }
      seen.add(node.props.onPress);
      return true;
    });
  expect(targets.length).toBeGreaterThan(0);
  await ReactTestRenderer.act(async () => {
    targets[0].props.onPress();
  });
};

const lockIconCount = (tree: Renderer): number =>
  tree.root.findAll(
    node =>
      typeof node.type !== 'string' &&
      (node.type as { name?: string }).name === 'Icon' &&
      node.props.name === 'lock',
  ).length;

beforeEach(async () => {
  const AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
  await AsyncStorage.clear();
  courseStore.resetForTests();
  await commitFixtureCourse();
  observedState = null;
  mockNavigate.mockClear();
  resetDevUnlockAllForTests();
});

describe('LearnScreen (schema-v2 course)', () => {
  it('renders 8 modules, 32 lessons and 8 module-test nodes', async () => {
    const tree = await renderLearn();
    const texts = textsOf(tree);
    expect(texts).toContain('0 / 32 lessons · 0 pts');
    for (const module of FIXTURE_COURSE_BUNDLE.modules) {
      expect(texts).toContain(`${module.sequence}. ${module.title}`);
    }
    expect(texts.filter(text => text === 'Module test')).toHaveLength(8);
    const lessonTitles = FIXTURE_COURSE_BUNDLE.modules.flatMap(module =>
      module.lessons.map(lesson => lesson.title),
    );
    expect(lessonTitles).toHaveLength(32);
    for (const title of lessonTitles) {
      expect(texts).toContain(title);
    }
  });

  it('locks everything past the current lesson, tests included', async () => {
    const tree = await renderLearn();
    const texts = textsOf(tree);
    // Lesson 1 is current.
    expect(texts).toContain('Continue');
    // 31 locked lessons + 8 locked module tests + the final exam.
    expect(lockIconCount(tree)).toBe(40);
  });

  it('opens every node when the dev unlock override is on', async () => {
    setDevUnlockAll(true);
    const tree = await renderLearn();
    expect(lockIconCount(tree)).toBe(0);

    // Any lesson, not just the first, is now tappable.
    const lastModule = FIXTURE_COURSE_BUNDLE.modules[7];
    const lastLesson = lastModule.lessons[lastModule.lessons.length - 1];
    await pressByText(tree, lastLesson.title);
    expect(mockNavigate).toHaveBeenCalledWith('Lesson', {
      lessonId: lastLesson.lessonId,
    });

    // Turning it back off restores sequential locking without a remount.
    await ReactTestRenderer.act(async () => {
      setDevUnlockAll(false);
    });
    expect(lockIconCount(tree)).toBe(40);
  });

  it('unlocks the module test after its lessons, and the next module after the test', async () => {
    const tree = await renderLearn();
    const firstModule = FIXTURE_COURSE_BUNDLE.modules[0];
    await ReactTestRenderer.act(async () => {
      for (const lesson of firstModule.lessons) {
        observedState!.applyLessonResult({
          lessonId: lesson.lessonId,
          answered: 5,
          correct: 5,
          points: 100,
          completed: true,
        });
      }
    });
    // Module 1 done → its test is unlocked (28 locked lessons in modules 2–8,
    // plus 7 locked tests, plus the still-locked final exam).
    expect(lockIconCount(tree)).toBe(36);

    await ReactTestRenderer.act(async () => {
      observedState!.applyTopicResult(firstModule.moduleId, 90);
    });
    const texts = textsOf(tree);
    expect(texts).toContain('90%');
    // Test passed → module 2 unlocks: its first lesson becomes current, its
    // other 3 lessons + its test stay locked, modules 3–8 stay fully locked,
    // and the final exam is still locked.
    expect(lockIconCount(tree)).toBe(35);
    expect(texts).toContain('4 / 32 lessons · 400 pts');
  });
});

describe('yellow marks on the ladder', () => {
  it('paints a completed-but-changed lesson yellow until it is retaken', async () => {
    await commitFixtureCourse();
    const lesson = FIXTURE_COURSE_BUNDLE.modules[0].lessons[0];
    const tree = await renderLearn();
    await ReactTestRenderer.act(async () => {
      observedState!.applyLessonResult({
        lessonId: lesson.lessonId,
        answered: 5,
        correct: 5,
        points: 100,
        completed: true,
      });
    });
    const redoNodes = () =>
      tree.root.findAll(
        node =>
          node.props.testID === 'lesson-redo' && String(node.type) === 'View',
      );
    expect(redoNodes()).toHaveLength(0);

    await ReactTestRenderer.act(async () => {
      primeMarksForTests('test-user', 'ca-class-c', {
        [lesson.lessonId]: {},
      });
    });
    expect(redoNodes()).toHaveLength(1);

    await ReactTestRenderer.act(async () => {
      await clearMark('test-user', 'ca-class-c', lesson.lessonId);
    });
    expect(redoNodes()).toHaveLength(0);
  });
});
