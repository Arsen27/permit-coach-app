import React from 'react';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import ScreenHeader from '@/components/ScreenHeader';
import { wasStreakModalShown } from '@/lib/streakModalStore';
import StreakScreen from '@/screens/StreakScreen';
import { AppStateProvider, useAppState } from '@/state/AppState';
import { localToday } from '@/state/streak';
import { defaultTheme } from '@/theme';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  // The sheet reads how it was presented (daily gate vs header chip) off the
  // route; rendered directly here, that is the manual path.
  useRoute: () => ({ params: { source: 'manual' } }),
}));

jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ userId: 'test-user' }),
}));

let observedState: ReturnType<typeof useAppState> | null = null;
const Probe: React.FC = () => {
  observedState = useAppState();
  return null;
};

const renderWith = async (children: React.ReactNode): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <AppStateProvider userId="test-user">
          <Probe />
          {children}
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

beforeEach(async () => {
  const AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
  await AsyncStorage.clear();
  observedState = null;
  mockNavigate.mockClear();
  mockGoBack.mockClear();
});

describe('header flame chip', () => {
  it('navigates to the Streak sheet on tap', async () => {
    const tree = await renderWith(<ScreenHeader title="Learn" />);
    const chip = tree.root.findAll(
      node =>
        typeof node.type !== 'string' &&
        node.props.accessibilityRole === 'button' &&
        typeof node.props.onPress === 'function',
    )[0];
    await ReactTestRenderer.act(async () => {
      chip.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('Streak', { source: 'manual' });
  });
});

describe('StreakScreen', () => {
  it('renders the sheet and marks today as shown', async () => {
    const tree = await renderWith(<StreakScreen />);
    const texts = textsOf(tree);
    expect(texts).toContain('day streak');
    expect(texts).toContain('Continue studying');
    expect(texts).toContain('Current streak');
    expect(await wasStreakModalShown('test-user', localToday())).toBe(true);
  });

  it('shows the starter copy when there is no streak yet', async () => {
    const tree = await renderWith(<StreakScreen />);
    expect(textsOf(tree)).toContain('One lesson today starts your streak.');
  });

  it('shows the studied-today copy after a lesson on a 1-day streak', async () => {
    const tree = await renderWith(<StreakScreen />);
    await ReactTestRenderer.act(async () => {
      observedState!.applyLessonResult({
        lessonId: 'lesson-1',
        answered: 5,
        correct: 5,
        points: 50,
        completed: true,
      });
    });
    const texts = textsOf(tree);
    expect(texts).toContain(
      "You've studied today — come back tomorrow to keep it going.",
    );
    expect(texts).toContain('Days studied');
  });
});
