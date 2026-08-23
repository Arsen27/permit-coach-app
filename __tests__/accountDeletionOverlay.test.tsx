import React from 'react';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';

import AccountDeletionOverlay from '@/components/AccountDeletionOverlay';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockAuth = {
  deletionState: 'idle' as 'idle' | 'deleting' | 'deleted',
  acknowledgeDeletion: jest.fn(),
};
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => mockAuth,
}));

const render = async (): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<AccountDeletionOverlay />);
  });
  return tree;
};

const texts = (tree: Renderer): string[] =>
  tree.root
    .findAll(node => typeof node.type === 'string' && node.props.children)
    .flatMap(node =>
      typeof node.props.children === 'string' ? [node.props.children] : [],
    );

const doneButton = (tree: Renderer) =>
  tree.root.findAll(
    node =>
      typeof node.type !== 'string' &&
      node.props.accessibilityLabel === 'Done' &&
      typeof node.props.onPress === 'function',
  )[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.deletionState = 'idle';
});

describe('account deletion overlay', () => {
  it('stays out of the way until a deletion starts', async () => {
    const tree = await render();
    // A hidden Modal renders nothing at all, so the app underneath is
    // untouched while no deletion is running.
    expect(texts(tree)).toEqual([]);
  });

  it('covers the teardown with a progress state', async () => {
    mockAuth.deletionState = 'deleting';
    const tree = await render();
    expect(texts(tree)).toContain('Deleting your account');
    expect(texts(tree)).not.toContain('Account deleted');
  });

  it('cannot be dismissed while the deletion is still running', async () => {
    mockAuth.deletionState = 'deleting';
    const tree = await render();

    // The button is on screen the whole time so the sheet never resizes, so
    // both guards matter: disabled for the touch system and the screen reader,
    // pointerEvents because a fully transparent view still takes taps.
    expect(doneButton(tree).props.accessibilityState).toEqual({
      disabled: true,
    });
    expect(
      tree.root.findAll(
        node =>
          typeof node.type === 'string' && node.props.pointerEvents === 'none',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('confirms the deletion once it has finished', async () => {
    mockAuth.deletionState = 'deleted';
    const tree = await render();
    const shown = texts(tree);

    expect(shown).toContain('Account deleted');
    expect(shown).not.toContain('Deleting your account');
    expect(shown.some(text => text.includes('gone for good'))).toBe(true);
  });

  it('hands the dismissal back to the provider', async () => {
    mockAuth.deletionState = 'deleted';
    const tree = await render();

    await ReactTestRenderer.act(async () => {
      doneButton(tree).props.onPress();
    });

    expect(mockAuth.acknowledgeDeletion).toHaveBeenCalledTimes(1);
  });
});
