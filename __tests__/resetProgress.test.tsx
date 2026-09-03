import React from 'react';
import { Alert } from 'react-native';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import { courseStore } from '@/data/course/store';
import {
  loadLessonPlace,
  saveLessonPlace,
} from '@/data/course/lessonProgressStore';
import YouScreen from '@/screens/YouScreen';
import { AppStateProvider, useAppState } from '@/state/AppState';
import { defaultTheme } from '@/theme';

// Starting over from Settings. Everything the learner earned goes, on this
// device and — through the wipe mark the sync engine reads — on every other
// one; the course itself is thrown away too, so the next check brings back
// whatever the channel serves now rather than the version they were on.

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({
    signedIn: true,
    hasAccount: true,
    email: 'learner@example.com',
    userId: 'test-user',
    logOut: jest.fn(),
    deleteAccount: jest.fn(),
  }),
}));

jest.mock('@/purchases/PurchasesProvider', () => ({
  usePurchases: () => ({
    isPlus: false,
    plusActive: false,
    purchasesEnabled: false,
    presentPaywall: jest.fn(),
    restore: jest.fn(),
  }),
}));

// The download is the lazy store's business; here it is a spy, so the test
// can see that the course was asked for again after the wipe.
const mockStart = jest.fn(async () => undefined);
jest.mock('@/data/course/useCourseInstall', () => ({
  useCourseInstall: () => ({
    phase: 'idle',
    progress: 0,
    start: mockStart,
    reset: jest.fn(),
  }),
}));

let observed: ReturnType<typeof useAppState> | null = null;
const Probe: React.FC = () => {
  observed = useAppState();
  return null;
};

const render = async (): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <AppStateProvider userId="test-user">
          <Probe />
          <YouScreen />
        </AppStateProvider>
      </ThemeProvider>,
    );
  });
  return tree;
};

const press = async (tree: Renderer, label: string): Promise<void> => {
  const targets = tree.root.findAll(
    node =>
      typeof node.type !== 'string' &&
      typeof node.props.onPress === 'function' &&
      node.props.accessibilityLabel === label,
  );
  if (targets.length === 0) {
    throw new Error(`no pressable labelled "${label}"`);
  }
  await ReactTestRenderer.act(async () => {
    targets[targets.length - 1].props.onPress();
  });
};

// The destructive choice inside the confirmation the row raises.
const confirm = async (alert: jest.SpyInstance): Promise<void> => {
  const [, , buttons] = alert.mock.calls.at(-1) as [
    string,
    string,
    { text: string; style?: string; onPress?: () => void }[],
  ];
  const destructive = buttons.find(button => button.style === 'destructive');
  expect(destructive).toBeDefined();
  await ReactTestRenderer.act(async () => {
    destructive!.onPress?.();
  });
};

const wipe = jest.spyOn(courseStore, 'wipeDownloadedContent');

beforeEach(async () => {
  const AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
  await AsyncStorage.clear();
  mockStart.mockClear();
  wipe.mockClear();
  wipe.mockResolvedValue(undefined);
  observed = null;
});

afterAll(() => {
  wipe.mockRestore();
});

const earnSomething = async (): Promise<void> => {
  await ReactTestRenderer.act(async () => {
    observed!.applyLessonResult({
      lessonId: 'ca-sign-shapes-and-colors',
      answered: 4,
      correct: 4,
      points: 100,
      completed: true,
    });
    observed!.applyTopicResult('road-signs', 80);
    observed!.applyExamResult(92);
    observed!.recordMistake('ca-q01');
    observed!.toggleSavedQuestion('ca-q02');
  });
};

it('names the course version this phone is running, for a developer', async () => {
  const tree = await render();
  const texts = tree.root
    .findAll(node => String(node.type) === 'Text')
    .map(node => node.children.filter(c => typeof c === 'string').join(''))
    .join(' | ');
  // __DEV__ is true under jest, so the developer section renders. Nothing is
  // downloaded in this test, and saying so is the point: a blank row would
  // read as "1.0.0" to whoever is debugging.
  expect(texts).toContain('Course version');
  expect(texts).toContain('Nothing downloaded for this state yet');
});

it('asks before it takes anything, and takes nothing on cancel', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const tree = await render();
  await earnSomething();
  expect(observed!.lessonsDone).toBe(1);

  await press(tree, 'Reset progress');
  const [title, message] = alert.mock.calls.at(-1) as [string, string];
  expect(title).toMatch(/reset all progress/i);
  // The words have to say what goes and what stays, and that the course is
  // downloaded again — this is the one screen where that is decided.
  expect(message).toMatch(/streak/i);
  expect(message).toMatch(/every device/i);
  expect(message).toMatch(/saved signs stay/i);
  expect(message).toMatch(/newest version/i);

  // Nothing happened yet: the alert is the whole action so far.
  expect(observed!.lessonsDone).toBe(1);
  expect(wipe).not.toHaveBeenCalled();
  expect(mockStart).not.toHaveBeenCalled();
  alert.mockRestore();
});

it('clears what was earned and brings the course back at its newest', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const tree = await render();
  await earnSomething();
  await saveLessonPlace('test-user', 'ca-sign-shapes-and-colors', {
    cardIndex: 3,
    answers: {},
  });

  await press(tree, 'Reset progress');
  await confirm(alert);

  // Everything the learner earned is gone.
  expect(observed!.lessonsDone).toBe(0);
  expect(observed!.points).toBe(0);
  expect(observed!.bestExam).toBeNull();
  expect(observed!.mistakeIds).toEqual([]);
  expect(observed!.savedQuestionIds).toEqual([]);
  expect(observed!.streak.currentStreak).toBe(0);
  expect(observed!.streak.daysStudied).toBe(0);
  // Including where they had stopped inside a lesson, which never syncs and
  // would otherwise survive the wipe.
  expect(
    await loadLessonPlace('test-user', 'ca-sign-shapes-and-colors'),
  ).toBeNull();

  // What is not progress stays.
  expect(observed!.user.stateCode).toBe('CA');

  // And the course comes back: nothing held means the next check takes
  // whatever the channel serves now.
  expect(wipe).toHaveBeenCalledTimes(1);
  expect(mockStart).toHaveBeenCalledWith('ca-class-c');
  alert.mockRestore();
});
