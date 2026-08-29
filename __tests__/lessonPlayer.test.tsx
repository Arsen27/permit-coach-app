import React from 'react';
import { Alert } from 'react-native';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import { buildCards } from '@/components/lesson/cards';
import { courseStore } from '@/data/course/store';
import type { CourseDocV2, ModuleDocV2 } from '@/data/course/v2/wire';
import { blockAssetIds } from '@/data/course/v2/wire';
import LessonOverviewScreen from '@/screens/LessonOverviewScreen';
import TheoryScreen from '@/screens/TheoryScreen';
import { AppStateProvider, useAppState } from '@/state/AppState';
import { defaultTheme } from '@/theme';

import {
  FIXTURE_COURSE_BUNDLE,
  commitFixtureCourse,
} from './fixtures/courseFixture';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const LESSON_ID = 'ca-sign-shapes-and-colors';
const moduleWithLesson = FIXTURE_COURSE_BUNDLE.modules.find(module =>
  module.lessons.some(entry => entry.lessonId === LESSON_ID),
)!;
const lesson = moduleWithLesson.lessons.find(
  entry => entry.lessonId === LESSON_ID,
)!;
const theoryQuestion = FIXTURE_COURSE_BUNDLE.questions.find(
  question => question.questionId === lesson.theoryQuestionIds?.[0],
)!;
const correctTheoryChoice = theoryQuestion.choices.find(
  choice => choice.id === theoryQuestion.correctAnswerId,
)!;
const CARD_COUNT = buildCards(lesson).length;
const heroAsset = FIXTURE_COURSE_BUNDLE.assets.find(
  asset => asset.assetId === lesson.blocks.flatMap(blockAssetIds)[0],
)!;

let observedState: ReturnType<typeof useAppState> | null = null;
const Probe: React.FC = () => {
  observedState = useAppState();
  return null;
};

type Player = {
  tree: Renderer;
  goBack: jest.Mock;
  replace: jest.Mock;
  popToTop: jest.Mock;
  headerOptions: () => any;
};

const renderPlayer = async (lessonId: string = LESSON_ID): Promise<Player> => {
  const goBack = jest.fn();
  const replace = jest.fn();
  const popToTop = jest.fn();
  let options: any = {};
  const setOptions = jest.fn((next: any) => {
    options = { ...options, ...next };
  });
  const navigation = { goBack, replace, popToTop, setOptions } as any;
  const route = { params: { lessonId } } as any;
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <AppStateProvider userId="test-user">
          <Probe />
          <TheoryScreen navigation={navigation} route={route} />
        </AppStateProvider>
      </ThemeProvider>,
    );
  });
  return { tree, goBack, replace, popToTop, headerOptions: () => options };
};

const textsOf = (tree: Renderer): string[] =>
  tree.root
    .findAll(node => String(node.type) === 'Text' && node.children.length > 0)
    .map(node =>
      node.children
        .map(child => (typeof child === 'string' ? child : ''))
        .join(''),
    );

const headerTexts = async (player: Player): Promise<string[]> => {
  const title = player.headerOptions().headerTitle;
  if (typeof title !== 'function') {
    return [];
  }
  let header!: Renderer;
  await ReactTestRenderer.act(async () => {
    header = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>{title()}</ThemeProvider>,
    );
  });
  return textsOf(header);
};

const pressHeaderItem = async (
  player: Player,
  side: 'unstable_headerLeftItems' | 'unstable_headerRightItems',
): Promise<void> => {
  const items = player.headerOptions()[side]?.() ?? [];
  expect(items.length).toBeGreaterThan(0);
  await ReactTestRenderer.act(async () => {
    items[0].onPress();
  });
};

const pressByText = async (tree: Renderer, text: string): Promise<void> => {
  const candidates = tree.root.findAll(node => {
    if (typeof node.props.onPress !== 'function' || node.props.disabled) {
      return false;
    }
    try {
      return node
        .findAll(inner => String(inner.type) === 'Text')
        .some(inner =>
          inner.children.some(
            child => typeof child === 'string' && child === text,
          ),
        );
    } catch {
      return false;
    }
  });
  expect(candidates.length).toBeGreaterThan(0);
  await ReactTestRenderer.act(async () => {
    candidates[candidates.length - 1].props.onPress();
  });
};

const primaryLabel = (tree: Renderer): string => {
  const texts = textsOf(tree);
  for (const label of ['Finish theory', 'Continue']) {
    if (texts.includes(label)) {
      return label;
    }
  }
  throw new Error('no theory button among: ' + texts.join(' | '));
};

const completeOpeningChallenge = async (tree: Renderer): Promise<void> => {
  await pressByText(tree, correctTheoryChoice.text);
  await pressByText(tree, 'Check answer');
};

const playTheory = async (tree: Renderer): Promise<Set<string>> => {
  const seen = new Set<string>();
  for (let step = 0; step < 30; step += 1) {
    textsOf(tree).forEach(text => seen.add(text));
    if (textsOf(tree).includes('Theory complete')) {
      return seen;
    }
    if (textsOf(tree).includes('Check answer')) {
      await completeOpeningChallenge(tree);
      continue;
    }
    // A check-yourself recall card: reveal the hidden words, then self-report.
    if (textsOf(tree).includes('Reveal words')) {
      await pressByText(tree, 'Reveal words');
      textsOf(tree).forEach(text => seen.add(text));
      await pressByText(tree, 'I knew it');
      continue;
    }
    await pressByText(tree, primaryLabel(tree));
  }
  throw new Error('theory never reached the complete card');
};

beforeEach(async () => {
  const AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
  await AsyncStorage.clear();
  courseStore.resetForTests();
  await commitFixtureCourse();
  observedState = null;
});

describe('split lesson experience', () => {
  it('opens with a summary and two independent paths', async () => {
    const navigate = jest.fn();
    const navigation = { navigate, goBack: jest.fn() } as any;
    const route = { params: { lessonId: LESSON_ID } } as any;
    let tree!: Renderer;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <ThemeProvider theme={defaultTheme}>
          <LessonOverviewScreen navigation={navigation} route={route} />
        </ThemeProvider>,
      );
    });

    const texts = textsOf(tree);
    expect(texts).toContain(lesson.title);
    // The lesson's own opening illustration leads the screen.
    expect(
      tree.root.findAll(
        node => node.props.accessibilityLabel === heroAsset.alt,
      ),
    ).not.toHaveLength(0);
    expect(texts.some(text => text.startsWith('Built for the'))).toBe(false);
    expect(texts).toContain(lesson.intro!.summary);
    expect(texts).toContain('Study the theory');
    expect(texts).toContain('Go straight to the test');
    expect(texts).toContain(String(CARD_COUNT));
    expect(texts).toContain('6');

    await pressByText(tree, 'Study the theory');
    expect(navigate).toHaveBeenCalledWith('Theory', {
      lessonId: LESSON_ID,
    });
    await pressByText(tree, 'Go straight to the test');
    expect(navigate).toHaveBeenCalledWith('Quiz', {
      mode: 'lessonTest',
      lessonId: LESSON_ID,
    });
  });

  it('installs native progress chrome for the conversation deck', async () => {
    const player = await renderPlayer();
    const options = player.headerOptions();
    expect(options.headerShown).toBe(true);
    expect(options.unstable_headerLeftItems()).toEqual([]);
    expect(options.unstable_headerRightItems()[0]).toMatchObject({
      type: 'button',
      icon: { type: 'sfSymbol', name: 'xmark' },
    });
    const title = await headerTexts(player);
    expect(title).toContain(lesson.title);
    expect(title).toContain(`1 / ${CARD_COUNT}`);
    expect(textsOf(player.tree)).toContain('Quick challenge');
    expect(textsOf(player.tree)).toContain('What would you do?');
  });

  it('adds a native back item after the first slide', async () => {
    const player = await renderPlayer();
    await completeOpeningChallenge(player.tree);
    await pressByText(player.tree, 'Continue');
    expect(await headerTexts(player)).toContain(`2 / ${CARD_COUNT}`);
    expect(player.headerOptions().unstable_headerLeftItems()[0]).toMatchObject({
      type: 'button',
      icon: { type: 'sfSymbol', name: 'chevron.left' },
    });
    await pressHeaderItem(player, 'unstable_headerLeftItems');
    expect(await headerTexts(player)).toContain(`1 / ${CARD_COUNT}`);
  });

  it('shows all teaching card families without grading theory', async () => {
    const player = await renderPlayer();
    const seen = await playTheory(player.tree);
    for (const kicker of [
      'Quick challenge',
      'Why it matters',
      'Core rule',
      'Visual example',
      'Related rule',
      'Exam trap',
      'Remember this',
    ]) {
      expect(seen).toContain(kicker);
    }
    expect(textsOf(player.tree)).toContain('Theory complete');
    expect(observedState!.lessonScores[LESSON_ID]).toBeUndefined();
  });

  it('starts the separate test after theory', async () => {
    const player = await renderPlayer();
    await playTheory(player.tree);
    await pressByText(player.tree, 'Start lesson test');
    expect(player.replace).toHaveBeenCalledWith('Quiz', {
      mode: 'lessonTest',
      lessonId: LESSON_ID,
    });
  });

  it('saves and restores theory position without creating a score', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const first = await renderPlayer();
    await completeOpeningChallenge(first.tree);
    await pressByText(first.tree, 'Continue');
    await pressByText(first.tree, 'Continue');
    await pressHeaderItem(first, 'unstable_headerRightItems');

    const [title, message, buttons] = alert.mock.calls[0] as [
      string,
      string,
      any[],
    ];
    expect(title).toBe('Leave this lesson?');
    expect(message).toContain(`card 3 of ${CARD_COUNT}`);
    expect(message).toContain('Your theory progress is saved.');
    await ReactTestRenderer.act(async () => {
      buttons[1].onPress();
      first.tree.unmount();
    });
    alert.mockRestore();

    const second = await renderPlayer();
    expect(await headerTexts(second)).toContain(`3 / ${CARD_COUNT}`);
    expect(observedState!.lessonScores[LESSON_ID]).toBeUndefined();
  });

  it('clears the saved slide position after theory is finished', async () => {
    const AsyncStorage =
      require('@react-native-async-storage/async-storage').default;
    const player = await renderPlayer();
    await playTheory(player.tree);
    const raw = await AsyncStorage.getItem(
      'dmv-prep/lesson-place/v2/test-user',
    );
    expect(JSON.parse(raw ?? '{}')[LESSON_ID]).toBeUndefined();
  });

  it('renders a graceful fallback for a future block type', async () => {
    const modifiedLesson = {
      ...lesson,
      blocks: [
        { blockId: 'x-b01', type: 'hologram_projection' },
        ...lesson.blocks.slice(1),
      ] as typeof lesson.blocks,
    };
    const moduleDoc: ModuleDocV2 = {
      schemaVersion: 2,
      deliveryVersion: '3.1.0',
      module: {
        ...moduleWithLesson,
        lessons: moduleWithLesson.lessons.map(entry =>
          entry.lessonId === LESSON_ID ? modifiedLesson : entry,
        ),
      },
      questions: FIXTURE_COURSE_BUNDLE.questions,
      assets: FIXTURE_COURSE_BUNDLE.assets,
    };
    const courseDoc: CourseDocV2 = {
      schemaVersion: 2,
      deliveryVersion: '3.1.0',
      course: {
        ...FIXTURE_COURSE_BUNDLE.course,
        moduleIds: [moduleWithLesson.moduleId],
      },
    };
    await courseStore.commit('3.1.0', courseDoc, [moduleDoc]);

    const player = await renderPlayer();
    expect(textsOf(player.tree)).toContain('One more thing');
    expect(primaryLabel(player.tree)).toBe('Continue');
  });
});
