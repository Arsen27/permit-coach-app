import React from 'react';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import RestoreResultModal, {
  RestoreOutcome,
} from '@/components/RestoreResultModal';
import { defaultTheme } from '@/theme';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const onDismiss = jest.fn();

const render = async (outcome: RestoreOutcome | null): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <RestoreResultModal outcome={outcome} onDismiss={onDismiss} />
      </ThemeProvider>,
    );
  });
  return tree;
};

const texts = (tree: Renderer): string[] =>
  tree.root
    .findAll(node => typeof node.type === 'string' && node.props.children)
    .flatMap(node =>
      typeof node.props.children === 'string' ? [node.props.children] : [],
    );

const pressAction = async (tree: Renderer, label: string) => {
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

beforeEach(() => jest.clearAllMocks());

describe('restore result modal', () => {
  it('shows nothing until a restore has reported back', async () => {
    expect(texts(await render(null))).toEqual([]);
  });

  it('confirms a restore that actually granted the subscription', async () => {
    const shown = texts(await render('restored'));
    expect(shown).toContain('Purchases restored');
    expect(shown.some(text => text.includes('active on this device'))).toBe(
      true,
    );
  });

  it('says so plainly when there was nothing to bring back', async () => {
    const shown = texts(await render('nothing'));
    expect(shown).toContain('Nothing to restore');
    // The most common real cause, named rather than left to guesswork.
    expect(shown.some(text => text.includes('different Apple ID'))).toBe(true);
  });

  it('separates a failed restore from an empty one', async () => {
    const shown = texts(await render('failed'));
    expect(shown).toContain('Restore did not finish');
    expect(shown).not.toContain('Nothing to restore');
  });

  it('hands each outcome its own dismissal', async () => {
    const tree = await render('restored');
    await pressAction(tree, 'Continue');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
