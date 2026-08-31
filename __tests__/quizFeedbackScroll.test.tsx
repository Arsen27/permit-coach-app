import React from 'react';
import { ScrollView } from 'react-native';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import { revealScrollOffset } from '@/lib/revealScroll';
import QuizScreen from '@/screens/QuizScreen';
import { AppStateProvider } from '@/state/AppState';
import { defaultTheme } from '@/theme';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const VIEWPORT = 700;
// Matches QuizScreen: a 54px CTA floating 22px above the (here zero) inset.
const CTA_STRIP = 76;

const renderQuiz = async (): Promise<Renderer> => {
  const navigation = {
    setOptions: jest.fn(),
    popToTop: jest.fn(),
    goBack: jest.fn(),
  } as any;
  const route = { params: { mode: 'signsQuiz' } } as any;
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <AppStateProvider userId="test-user">
          <QuizScreen navigation={navigation} route={route} />
        </AppStateProvider>
      </ThemeProvider>,
    );
  });
  // Let the artwork gate warm the sign vectors (it yields between parse
  // chunks) and lift the entry skeleton.
  await ReactTestRenderer.act(async () => {
    for (let i = 0; i < 4; i += 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  });
  return tree;
};

const scrollView = (tree: Renderer) => tree.root.findByType(ScrollView);

const scrollTo = (tree: Renderer): jest.Mock =>
  (scrollView(tree).instance as unknown as { scrollTo: jest.Mock }).scrollTo;

const layoutScroll = async (tree: Renderer): Promise<void> => {
  await ReactTestRenderer.act(async () => {
    scrollView(tree).props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: VIEWPORT } },
    });
  });
};

const pressWithLabel = async (tree: Renderer, label: string): Promise<void> => {
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

// Answer the current question so the feedback block renders.
const answerAndCheck = async (tree: Renderer): Promise<void> => {
  const options = tree.root.findAll(
    node =>
      typeof node.type !== 'string' &&
      typeof node.props.onPress === 'function' &&
      node.props.$state != null,
  );
  await ReactTestRenderer.act(async () => {
    options[0].props.onPress();
  });
  await pressWithLabel(tree, 'Check answer');
};

// The feedback block is the only child laid out through onFeedbackLayout.
const feedbackNode = (tree: Renderer) =>
  tree.root.find(
    node => typeof node.type !== 'string' && node.props.$correct != null,
  );

const layoutFeedback = async (
  tree: Renderer,
  y: number,
  height: number,
): Promise<void> => {
  await ReactTestRenderer.act(async () => {
    feedbackNode(tree).props.onLayout({
      nativeEvent: { layout: { x: 0, y, width: 350, height } },
    });
  });
};

beforeEach(async () => {
  const AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
  await AsyncStorage.clear();
});

describe('revealScrollOffset', () => {
  const base = { offset: 0, viewport: 700, bottomOverlay: 76, margin: 12 };

  it('stays put when the block already fits above the floating CTA', () => {
    // Bottom at 500, visible down to 700 - 76 = 624.
    expect(
      revealScrollOffset({ ...base, blockY: 400, blockHeight: 100 }),
    ).toBeNull();
  });

  it('stays put when the block ends exactly at the visible edge', () => {
    expect(
      revealScrollOffset({ ...base, blockY: 524, blockHeight: 100 }),
    ).toBeNull();
  });

  it('scrolls just far enough to clear the CTA when cut off', () => {
    // Bottom at 900; needs 900 + 12 - 700 + 76 = 288.
    expect(revealScrollOffset({ ...base, blockY: 800, blockHeight: 100 })).toBe(
      288,
    );
  });

  it('accounts for how far the list is already scrolled', () => {
    expect(
      revealScrollOffset({
        ...base,
        offset: 200,
        blockY: 800,
        blockHeight: 100,
      }),
    ).toBe(288);
  });

  it('aligns the top of a block taller than the viewport', () => {
    // Bottom-aligning would hide the "Not quite" heading; show the top.
    expect(revealScrollOffset({ ...base, blockY: 300, blockHeight: 900 })).toBe(
      288,
    );
  });

  it('never scrolls backwards', () => {
    expect(
      revealScrollOffset({
        ...base,
        offset: 500,
        blockY: 300,
        blockHeight: 900,
      }),
    ).toBeNull();
  });

  it('waits for a real measurement', () => {
    expect(
      revealScrollOffset({ ...base, viewport: 0, blockY: 800, blockHeight: 1 }),
    ).toBeNull();
    expect(
      revealScrollOffset({ ...base, blockY: 800, blockHeight: 0 }),
    ).toBeNull();
  });
});

describe('QuizScreen answer feedback', () => {
  it('scrolls the feedback into view when it lands below the fold', async () => {
    const tree = await renderQuiz();
    await layoutScroll(tree);
    await answerAndCheck(tree);

    scrollTo(tree).mockClear();
    await layoutFeedback(tree, 820, 120);

    expect(scrollTo(tree)).toHaveBeenCalledWith({
      y: 820 + 120 + 12 - VIEWPORT + CTA_STRIP,
      animated: true,
    });
  });

  it('leaves the list alone when the feedback is already visible', async () => {
    const tree = await renderQuiz();
    await layoutScroll(tree);
    await answerAndCheck(tree);

    scrollTo(tree).mockClear();
    await layoutFeedback(tree, 300, 120);

    expect(scrollTo(tree)).not.toHaveBeenCalled();
  });

  it('nudges only once per reveal, so a re-layout cannot fight the user', async () => {
    const tree = await renderQuiz();
    await layoutScroll(tree);
    await answerAndCheck(tree);

    scrollTo(tree).mockClear();
    await layoutFeedback(tree, 820, 120);
    await layoutFeedback(tree, 900, 120);

    expect(scrollTo(tree)).toHaveBeenCalledTimes(1);
  });

  it('returns to the top of the next question', async () => {
    const tree = await renderQuiz();
    await layoutScroll(tree);
    await answerAndCheck(tree);
    await layoutFeedback(tree, 820, 120);

    scrollTo(tree).mockClear();
    await pressWithLabel(tree, 'Continue');

    expect(scrollTo(tree)).toHaveBeenCalledWith({ y: 0, animated: false });
  });
});
