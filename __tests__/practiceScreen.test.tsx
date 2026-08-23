import React from 'react';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import { questionBankIds } from '@/data/practice';
import PracticeScreen from '@/screens/PracticeScreen';
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

const render = async (): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <AppStateProvider userId="test-user">
          <Probe />
          <PracticeScreen />
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

// Text rendered anywhere inside a node — used to find a button by its label
// without reaching into the element tree by shape.
const textWithin = (node: {
  findAll: (
    predicate: (candidate: { type: unknown; children: unknown[] }) => boolean,
  ) => { children: unknown[] }[];
}): string =>
  node
    .findAll(candidate => String(candidate.type) === 'Text')
    .flatMap(text => text.children.filter(c => typeof c === 'string'))
    .join(' ');

const pressWithText = async (tree: Renderer, text: string): Promise<void> => {
  const targets = tree.root.findAll(
    node =>
      typeof node.type !== 'string' &&
      typeof node.props.onPress === 'function' &&
      textWithin(node).includes(text),
  );
  if (targets.length === 0) {
    throw new Error(`no pressable containing "${text}"`);
  }
  await ReactTestRenderer.act(async () => {
    // The innermost pressable carrying the label is the button itself.
    targets[targets.length - 1].props.onPress();
  });
};

beforeEach(async () => {
  const AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
  await AsyncStorage.clear();
  observedState = null;
  mockNavigate.mockClear();
});

describe('PracticeScreen (variant C)', () => {
  it('renders the modes, exam bar, bank map and topic band', async () => {
    const tree = await render();
    const texts = textsOf(tree);

    expect(texts).toContain('Quick 10');
    expect(texts).toContain('Missed only');
    expect(texts).toContain('Saved');
    expect(texts).toContain('Exam simulator');
    expect(texts).toContain('46 questions · 60 min');
    expect(texts).toContain('Your question bank');
    expect(texts).toContain('Where you stand');
    // Legend covers every earned state.
    expect(texts).toEqual(
      expect.arrayContaining(['Mastered', 'Seen once', 'Shaky', 'Missed']),
    );
  });

  it('draws one bank cell per question in the bank', async () => {
    const tree = await render();
    const cells = tree.root.findAll(
      node =>
        node.props.testID === 'bank-cell' && typeof node.type === 'string',
    );
    expect(cells).toHaveLength(questionBankIds().length);
    expect(questionBankIds().length).toBeGreaterThan(200);
  });

  it('starts with an empty bank and counts answers as they land', async () => {
    const tree = await render();
    const total = questionBankIds().length;
    expect(textsOf(tree)).toContain(`0 / ${total}`);

    const [first, second] = questionBankIds();
    await ReactTestRenderer.act(async () => {
      observedState!.recordQuestionAnswer(first, true);
      observedState!.recordQuestionAnswer(second, false);
    });

    expect(textsOf(tree)).toContain(`2 / ${total}`);
  });

  it('shows the best exam score once one exists', async () => {
    const tree = await render();
    await ReactTestRenderer.act(async () => {
      observedState!.applyExamResult(72);
    });
    expect(textsOf(tree)).toContain('46 questions · 60 min · best 72%');
  });

  it('shows mistake and saved counts on their mode cards', async () => {
    const tree = await render();
    await ReactTestRenderer.act(async () => {
      observedState!.recordMistake('q-a');
      observedState!.recordMistake('q-b');
      observedState!.toggleSavedQuestion('q-c');
    });
    const texts = textsOf(tree);
    expect(texts).toContain('2');
    expect(texts).toContain('1');
  });

  it('routes each mode to its quiz', async () => {
    const tree = await render();

    await pressWithText(tree, 'Quick 10');
    expect(mockNavigate).toHaveBeenLastCalledWith('Quiz', {
      mode: 'quickMix',
    });

    await pressWithText(tree, 'Missed only');
    expect(mockNavigate).toHaveBeenLastCalledWith('Quiz', { mode: 'mistakes' });

    await pressWithText(tree, 'Your bookmarks');
    expect(mockNavigate).toHaveBeenLastCalledWith('Quiz', { mode: 'saved' });

    await pressWithText(tree, 'Start');
    expect(mockNavigate).toHaveBeenLastCalledWith('Quiz', { mode: 'exam' });
  });

  it('points the third mode at the weakest scored topic', async () => {
    const tree = await render();
    // Score every topic so none is untouched; road-signs is the weakest.
    await ReactTestRenderer.act(async () => {
      observedState!.applyTopicResult('road-signs', 30);
      observedState!.applyTopicResult('right-of-way', 80);
      observedState!.applyTopicResult('speed-lanes', 90);
      observedState!.applyTopicResult('parking-stopping', 70);
      observedState!.applyTopicResult('alcohol-penalties', 60);
    });

    expect(textsOf(tree)).toContain('Weakest topic · 30%');

    await pressWithText(tree, 'Weakest topic · 30%');
    expect(mockNavigate).toHaveBeenLastCalledWith('Quiz', {
      mode: 'topic',
      topicId: 'road-signs',
    });
  });

  it('shows a dash for topics with no score yet', async () => {
    const tree = await render();
    expect(textsOf(tree).filter(text => text === '—').length).toBeGreaterThan(
      0,
    );

    await ReactTestRenderer.act(async () => {
      observedState!.applyTopicResult('right-of-way', 58);
    });
    expect(textsOf(tree)).toContain('58%');
  });
});
