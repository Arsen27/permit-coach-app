import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import CourseUpdateOverlay, {
  CourseUpdatePhase,
} from '@/components/CourseUpdateOverlay';
import UpdateManager from '@/data/course/UpdateManager';
import { acceptCourseOffer, runCourseUpdate } from '@/data/course/updater';
import { defaultTheme } from '@/theme';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/data/course/updater', () => ({
  runCourseUpdate: jest.fn(),
  acceptCourseOffer: jest.fn(),
  drainPrompt: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ userId: 'user-1' }),
}));

// Held outside the factory so their identity is stable across renders — the
// updater callback depends on them, and fresh functions would re-arm the
// foreground listener on every render.
const mockResetLessons = jest.fn();
const mockResetTopics = jest.fn();
jest.mock('@/state/AppState', () => ({
  useAppState: () => ({
    lessonScores: {},
    topicScores: {},
    resetLessons: mockResetLessons,
    resetTopics: mockResetTopics,
  }),
}));

jest.mock('@/lib/onboardingFlag', () => ({
  isOnboardingDone: () => Promise.resolve(true),
}));

const mockRun = runCourseUpdate as jest.MockedFunction<typeof runCourseUpdate>;
const mockAccept = acceptCourseOffer as jest.MockedFunction<
  typeof acceptCourseOffer
>;

const texts = (tree: Renderer): string[] =>
  tree.root
    .findAll(node => typeof node.type === 'string' && node.props.children)
    .flatMap(node =>
      typeof node.props.children === 'string' ||
      typeof node.props.children === 'number'
        ? [String(node.props.children)]
        : [],
    );

const renderOverlay = async (
  phase: CourseUpdatePhase,
  progress = 0,
): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <CourseUpdateOverlay phase={phase} progress={progress} />
      </ThemeProvider>,
    );
  });
  return tree;
};

const renderManager = async (): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <UpdateManager />
      </ThemeProvider>,
    );
  });
  return tree;
};

// The displayed progress eases toward its target on a timer, so tests fast
// forward through the sweep instead of asserting the very first frame.
const settle = async (ms: number) => {
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('course update sheet', () => {
  it('renders nothing while no update is running', async () => {
    const tree = await renderOverlay('idle');
    expect(texts(tree)).toEqual([]);
  });

  it('eases the shown progress toward the real download progress', async () => {
    const tree = await renderOverlay('downloading', 0.25);

    // A few ticks in, the sweep is under way but nowhere near the target —
    // the snap-to-value jump this animation replaces.
    await settle(150);
    const early = Number(texts(tree).find(text => /^\d+$/.test(text)) ?? '-1');
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(25);

    // …and settles on it once the easing converges.
    await settle(4000);
    const shown = texts(tree);
    expect(shown).toContain('Updating your course');
    expect(shown).toContain('25');
    expect(shown).not.toContain('Course updated');
  });

  it('fills the ring before the confirmation takes its place', async () => {
    const tree = await renderOverlay('done', 1);

    // Mid-fill the ring is still on screen.
    expect(texts(tree)).toContain('Updating your course');

    await settle(2000);
    const shown = texts(tree);
    expect(shown).toContain('Course updated');
    expect(shown).not.toContain('Updating your course');
  });

  it('owns up to an interrupted download instead of vanishing', async () => {
    const tree = await renderOverlay('failed');
    const shown = texts(tree);

    expect(shown).toContain('Update interrupted');
    expect(shown.some(text => text.includes('untouched'))).toBe(true);
  });
});

describe('update manager', () => {
  it('shows nothing on a launch with no content to fetch', async () => {
    // The overwhelmingly common case: the server has nothing newer, so
    // onProgress never fires and the launch must stay untouched.
    mockRun.mockResolvedValue({ status: 'up-to-date' });

    const tree = await renderManager();

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(texts(tree)).toEqual([]);
  });

  it('raises the sheet only once a download is actually in flight', async () => {
    mockRun.mockImplementation(async deps => {
      deps.onProgress?.({ fetched: 2, total: 8 });
      // Left pending so the sheet can be inspected mid-download.
      return new Promise(() => undefined);
    });

    const tree = await renderManager();
    await settle(4000);
    const shown = texts(tree);

    expect(shown).toContain('Updating your course');
    expect(shown).toContain('25');
  });

  it('reports an interrupted download and then clears the sheet', async () => {
    mockRun.mockImplementation(async deps => {
      deps.onProgress?.({ fetched: 1, total: 8 });
      return { status: 'offline' };
    });

    const tree = await renderManager();

    // Past the minimum visible window the sheet switches to the failure note
    // rather than silently vanishing — nothing was committed on device.
    await settle(1200);
    expect(texts(tree)).toContain('Update interrupted');

    // The note holds for a beat, then the sheet leaves on its own.
    await settle(3000);
    expect(texts(tree)).toEqual([]);
  });
});

describe('opt-in course offer', () => {
  const OFFER = { version: '4.0.0', notes: 'A rebuilt, better course.' };

  const pressByLabel = async (tree: Renderer, label: string) => {
    const button = tree.root.findAll(
      node =>
        typeof node.type !== 'string' &&
        node.props.accessibilityLabel === label &&
        typeof node.props.onPress === 'function',
    )[0];
    await ReactTestRenderer.act(async () => {
      button.props.onPress();
    });
  };

  it('shows the offer with its notes and the fresh-start warning', async () => {
    mockRun.mockResolvedValue({ status: 'up-to-date', offer: OFFER });

    const tree = await renderManager();
    const shown = texts(tree);

    expect(shown).toContain('A new course is ready');
    expect(shown).toContain('A rebuilt, better course.');
    expect(
      shown.some(text => text.includes('clears your course progress')),
    ).toBe(true);
  });

  it('declining hides the offer and keeps it declined on later checks', async () => {
    mockRun.mockResolvedValue({ status: 'up-to-date', offer: OFFER });

    const tree = await renderManager();
    await pressByLabel(tree, 'Not now');
    expect(texts(tree)).toEqual([]);

    // A later check with the same offer stays quiet — "not now" is remembered
    // per version, not per session.
    const again = await renderManager();
    expect(texts(again)).toEqual([]);
  });

  it('accepting downloads the new course and confirms the fresh start', async () => {
    mockRun.mockResolvedValue({ status: 'up-to-date', offer: OFFER });
    mockAccept.mockImplementation(async deps => {
      deps.onProgress?.({ fetched: 1, total: 2 });
      return { status: 'updated' };
    });

    const tree = await renderManager();
    await pressByLabel(tree, 'Start the new course');

    expect(mockAccept).toHaveBeenCalledTimes(1);
    // Past the minimum visible window the phase flips to done…
    await settle(1000);
    // …the ring fills, and the confirmation takes its place.
    await settle(800);
    expect(texts(tree)).toContain('Course updated');
    // And the sheet leaves on its own.
    await settle(3000);
    expect(texts(tree)).toEqual([]);
  });

  it('a failed accept keeps the offer for the next check', async () => {
    mockRun.mockResolvedValue({ status: 'up-to-date', offer: OFFER });
    mockAccept.mockResolvedValue({ status: 'offline' });

    const tree = await renderManager();
    await pressByLabel(tree, 'Start the new course');
    await settle(1200);
    expect(texts(tree)).toContain('Update interrupted');
    await settle(3000);
    expect(texts(tree)).toEqual([]);

    // Nothing was declined, so the offer returns on the next check.
    const again = await renderManager();
    expect(texts(again)).toContain('A new course is ready');
  });
});
