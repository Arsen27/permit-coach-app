import React from 'react';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import { findCategory, savedSigns, signs } from '@/data/signs';
import SavedSignsScreen from '@/screens/SavedSignsScreen';
import SignsScreen from '@/screens/SignsScreen';
import { AppStateProvider, useAppState } from '@/state/AppState';
import { defaultTheme } from '@/theme';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const navigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  setOptions: jest.fn(),
};

let observedState: ReturnType<typeof useAppState> | null = null;
const Probe: React.FC = () => {
  observedState = useAppState();
  return null;
};

const render = async (screen: React.ReactNode): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <AppStateProvider userId="test-user">
          <Probe />
          {screen}
        </AppStateProvider>
      </ThemeProvider>,
    );
  });
  return tree;
};

type SavedSignsProps = React.ComponentProps<typeof SavedSignsScreen>;

// The screen reads `navigation` and nothing off the route, so a hand-built
// prop pair stands in for a real navigator.
const renderSaved = (): Promise<Renderer> =>
  render(
    <SavedSignsScreen
      {...({
        navigation,
        route: { key: 'saved-1', name: 'SavedSigns', params: undefined },
      } as unknown as SavedSignsProps)}
    />,
  );

const textsOf = (tree: Renderer): string[] =>
  tree.root
    .findAll(node => String(node.type) === 'Text' && node.children.length > 0)
    .map(node =>
      node.children
        .map(child => (typeof child === 'string' ? child : ''))
        .join(''),
    );

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
    targets[targets.length - 1].props.onPress();
  });
};

// Two signs that sit in different categories, so the grouping has something
// to group.
const twoSignsInDifferentCategories = () => {
  const first = signs[0];
  const second = signs.find(sign => sign.categoryId !== first.categoryId);
  if (second == null) {
    throw new Error('seed catalogue has only one category');
  }
  return [first, second] as const;
};

beforeEach(async () => {
  const AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
  await AsyncStorage.clear();
  observedState = null;
  mockNavigate.mockClear();
  navigation.setOptions.mockClear();
});

describe('savedSigns()', () => {
  it('resolves bookmark ids in the order they were saved', () => {
    const [first, second] = twoSignsInDifferentCategories();
    expect(savedSigns([second.id, first.id]).map(sign => sign.id)).toEqual([
      second.id,
      first.id,
    ]);
  });

  it('drops ids the catalogue no longer has', () => {
    expect(savedSigns(['not-a-sign', signs[0].id])).toEqual([signs[0]]);
  });
});

describe('SavedSignsScreen', () => {
  it('explains how to fill the list while it is empty', async () => {
    const tree = await renderSaved();
    const texts = textsOf(tree);

    expect(texts).toContain('Nothing saved yet');
    expect(texts.some(text => text.includes('tap the bookmark'))).toBe(true);
  });

  it('groups saved signs under their category', async () => {
    const tree = await renderSaved();
    const [first, second] = twoSignsInDifferentCategories();

    await ReactTestRenderer.act(async () => {
      observedState!.toggleSavedSign(first.id);
      observedState!.toggleSavedSign(second.id);
    });

    const texts = textsOf(tree);
    expect(texts).toContain(first.name);
    expect(texts).toContain(second.name);
    expect(texts).toContain(findCategory(first.categoryId)!.name);
    expect(texts).toContain(findCategory(second.categoryId)!.name);
    expect(texts).not.toContain('Nothing saved yet');
  });

  it('drops a sign as soon as it is unsaved', async () => {
    const tree = await renderSaved();
    const [first] = twoSignsInDifferentCategories();

    await ReactTestRenderer.act(async () => {
      observedState!.toggleSavedSign(first.id);
    });
    expect(textsOf(tree)).toContain(first.name);

    await ReactTestRenderer.act(async () => {
      observedState!.toggleSavedSign(first.id);
    });
    expect(textsOf(tree)).not.toContain(first.name);
    expect(textsOf(tree)).toContain('Nothing saved yet');
  });

  it('opens the sign detail from a card', async () => {
    const tree = await renderSaved();
    const [first] = twoSignsInDifferentCategories();

    await ReactTestRenderer.act(async () => {
      observedState!.toggleSavedSign(first.id);
    });
    await pressWithText(tree, first.name);

    expect(mockNavigate).toHaveBeenLastCalledWith('SignDetail', {
      signId: first.id,
    });
  });
});

describe('SignsScreen saved row', () => {
  it('prompts for a first bookmark, then counts them', async () => {
    const tree = await render(<SignsScreen />);
    expect(textsOf(tree)).toContain('Bookmark a sign to keep it here');

    const [first, second] = twoSignsInDifferentCategories();
    await ReactTestRenderer.act(async () => {
      observedState!.toggleSavedSign(first.id);
    });
    expect(textsOf(tree)).toContain('1 sign · your bookmarks');

    await ReactTestRenderer.act(async () => {
      observedState!.toggleSavedSign(second.id);
    });
    expect(textsOf(tree)).toContain('2 signs · your bookmarks');
  });

  it('counts only bookmarks the catalogue still has', async () => {
    const tree = await render(<SignsScreen />);
    await ReactTestRenderer.act(async () => {
      observedState!.toggleSavedSign('sign-that-was-removed');
    });
    expect(textsOf(tree)).toContain('Bookmark a sign to keep it here');
  });

  it('opens the saved list', async () => {
    const tree = await render(<SignsScreen />);
    await pressWithText(tree, 'Saved signs');
    expect(mockNavigate).toHaveBeenLastCalledWith('SavedSigns');
  });
});
