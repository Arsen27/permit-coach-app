import React from 'react';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import { SEED_COURSE_BUNDLE } from '@/data/course';
import { FINAL_EXAM_TOPIC_ID, courseUnitProgress } from '@/data/course/learn';
import { courseStore } from '@/data/course/store';
import { EXAM_LENGTH, finalExamQuestions } from '@/data/practice';
import { resetDevUnlockAllForTests, setDevUnlockAll } from '@/lib/devUnlock';
import LearnScreen from '@/screens/LearnScreen';
import { AppStateProvider, useAppState } from '@/state/AppState';
import { defaultTheme } from '@/theme';

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

// The one node whose label is "Final exam" — walks up from the label to the
// enclosing pressable so the test does not depend on the node's internals.
const finalExamNode = (tree: Renderer) => {
  const nodes = tree.root.findAll(
    node =>
      typeof node.props.onPress === 'function' &&
      node
        .findAll(inner => String(inner.type) === 'Text')
        .some(inner => inner.children.some(child => child === 'Final exam')),
  );
  expect(nodes.length).toBeGreaterThan(0);
  return nodes[nodes.length - 1];
};

// The dashed continuation drawn from the last module down into the finale.
const finalConnector = (tree: Renderer) => {
  // findAll returns the <Path> element and its host descendants, all carrying
  // the same `d`; the outermost one holds the props as this screen passes them.
  const paths = tree.root.findAll(
    node =>
      typeof node.props.d === 'string' && node.props.d.startsWith('M 196.5 0'),
  );
  expect(paths.length).toBeGreaterThan(0);
  return paths[0];
};

const completeWholeCourse = async (): Promise<void> => {
  await ReactTestRenderer.act(async () => {
    for (const module of SEED_COURSE_BUNDLE.modules) {
      for (const lesson of module.lessons) {
        observedState!.applyLessonResult({
          lessonId: lesson.lessonId,
          answered: 5,
          correct: 5,
          points: 100,
          completed: true,
        });
      }
      observedState!.applyTopicResult(module.moduleId, 90);
    }
  });
};

beforeEach(async () => {
  const AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
  await AsyncStorage.clear();
  courseStore.resetForTests();
  observedState = null;
  mockNavigate.mockClear();
  resetDevUnlockAllForTests();
});

describe('final exam paper', () => {
  it('draws only from the course, without repeating a question', () => {
    const questions = finalExamQuestions();
    const courseIds = new Set(
      SEED_COURSE_BUNDLE.questions.map(question => question.questionId),
    );

    expect(questions.length).toBeGreaterThan(0);
    expect(questions.length).toBeLessThanOrEqual(EXAM_LENGTH);
    for (const question of questions) {
      expect(courseIds.has(question.id)).toBe(true);
    }
    expect(new Set(questions.map(question => question.id)).size).toBe(
      questions.length,
    );
  });

  it('represents every module, rather than sampling the bank flat', () => {
    const asked = new Set(finalExamQuestions().map(question => question.id));
    for (const module of SEED_COURSE_BUNDLE.modules) {
      const pool = new Set([
        ...module.lessons.flatMap(
          lesson => lesson.testQuestionIds ?? lesson.questionIds,
        ),
        ...module.moduleTest.questionIds,
      ]);
      expect([...pool].some(id => asked.has(id))).toBe(true);
    }
  });

  it('honours a shorter paper', () => {
    expect(finalExamQuestions(5)).toHaveLength(5);
  });
});

describe('courseUnitProgress', () => {
  it('counts a unit only when its lessons and its test are both done', () => {
    const [first] = SEED_COURSE_BUNDLE.modules;
    const lessonsDone = new Set(first.lessons.map(lesson => lesson.lessonId));

    // Lessons done, test not taken yet.
    expect(
      courseUnitProgress(
        id => lessonsDone.has(id),
        () => false,
      ),
    ).toEqual({ doneUnits: 0, totalUnits: 8 });

    // Test taken too.
    expect(
      courseUnitProgress(
        id => lessonsDone.has(id),
        id => id === first.moduleId,
      ),
    ).toEqual({ doneUnits: 1, totalUnits: 8 });
  });
});

describe('final exam node on the ladder', () => {
  it('stays locked until every unit is finished, and says how far off it is', async () => {
    const tree = await renderLearn();
    expect(textsOf(tree)).toContain('0 of 8 units done');
    expect(finalExamNode(tree).props.disabled).toBe(true);

    const [first] = SEED_COURSE_BUNDLE.modules;
    await ReactTestRenderer.act(async () => {
      for (const lesson of first.lessons) {
        observedState!.applyLessonResult({
          lessonId: lesson.lessonId,
          answered: 5,
          correct: 5,
          points: 100,
          completed: true,
        });
      }
      observedState!.applyTopicResult(first.moduleId, 90);
    });

    expect(textsOf(tree)).toContain('1 of 8 units done');
    expect(finalExamNode(tree).props.disabled).toBe(true);
  });

  it('unlocks once the whole course is done and opens the exam', async () => {
    const tree = await renderLearn();
    await completeWholeCourse();

    const texts = textsOf(tree);
    expect(texts).toContain('Final exam');
    expect(texts.some(text => text.endsWith('83% to pass'))).toBe(true);

    const node = finalExamNode(tree);
    expect(node.props.disabled).toBe(false);
    await ReactTestRenderer.act(async () => {
      node.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('Quiz', { mode: 'finalExam' });
  });

  it('shows the best score, and only calls it passed at the pass mark', async () => {
    const tree = await renderLearn();
    await completeWholeCourse();

    await ReactTestRenderer.act(async () => {
      observedState!.applyTopicResult(FINAL_EXAM_TOPIC_ID, 70);
    });
    expect(textsOf(tree)).toContain('70%');
    expect(textsOf(tree)).toContain('Best 70% · 83% to pass');

    await ReactTestRenderer.act(async () => {
      observedState!.applyTopicResult(FINAL_EXAM_TOPIC_ID, 88);
    });
    expect(textsOf(tree)).toContain('88%');
    expect(textsOf(tree)).toContain('Passed · best 88%');

    // Best score, not last score: a worse retake does not undo the pass.
    await ReactTestRenderer.act(async () => {
      observedState!.applyTopicResult(FINAL_EXAM_TOPIC_ID, 40);
    });
    expect(textsOf(tree)).toContain('Passed · best 88%');
  });
});

describe('the track into the final exam', () => {
  it('stays grey and dashed until the course is actually finished', async () => {
    const tree = await renderLearn();
    expect(finalConnector(tree).props.stroke).toBe(defaultTheme.colors.faint);
    expect(finalConnector(tree).props.strokeDasharray).toBe('2 8');
  });

  // Regression: the track used to key off `locked`, which the dev override
  // forces false — so "unlock all lessons" drew a travelled green path to a
  // finale the learner had not walked a single step towards. Everywhere else
  // on the ladder the done overlay comes from real scores only.
  it('is not greened by the dev unlock override', async () => {
    setDevUnlockAll(true);
    const tree = await renderLearn();

    // Tappable...
    expect(finalExamNode(tree).props.disabled).toBe(false);
    // ...but plainly not travelled.
    expect(finalConnector(tree).props.stroke).toBe(defaultTheme.colors.faint);
    expect(finalConnector(tree).props.strokeDasharray).toBe('2 8');
  });

  it('turns into a travelled path once every unit is done', async () => {
    const tree = await renderLearn();
    await completeWholeCourse();

    expect(finalConnector(tree).props.stroke).toBe(
      defaultTheme.colors.doneLine,
    );
    expect(finalConnector(tree).props.strokeDasharray).toBeUndefined();
  });
});
