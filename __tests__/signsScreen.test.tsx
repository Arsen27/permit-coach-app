import React from 'react';
import ReactTestRenderer, {
  ReactTestInstance,
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import SignsScreen from '@/screens/SignsScreen';
import { AppStateProvider } from '@/state/AppState';
import { defaultTheme } from '@/theme';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// A catalogue the app has never seen: two of these glyphs and all three
// colours appear nowhere in the bundled seed. The screen used to switch on
// known category ids, so anything authored later fell back to the work-zone
// diamond in the work-zone orange — these fixtures guard that regression.
const CATEGORIES = [
  {
    id: 'regulatory',
    name: 'Regulatory',
    subtitle: 'rules you must obey',
    blurb: 'blurb',
    color: '#C8102E',
    glyph: 'octagon',
  },
  {
    id: 'school',
    name: 'School zone',
    subtitle: 'near schools',
    blurb: 'blurb',
    color: '#C9D64F',
    glyph: 'pennant',
  },
  {
    id: 'parking',
    name: 'Parking',
    subtitle: 'where you may stop',
    blurb: 'blurb',
    color: '#1B7FD4',
    glyph: 'circle',
  },
];

jest.mock('@/data/signs', () => ({
  get signCategories() {
    return CATEGORIES;
  },
  signsByCategory: (categoryId: string) =>
    categoryId === 'parking' ? [{ id: 'p1' }] : [{ id: 'a' }, { id: 'b' }],
}));

const renderSigns = async (): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <AppStateProvider userId="test-user">
          <SignsScreen />
        </AppStateProvider>
      </ThemeProvider>,
    );
  });
  return tree;
};

const textUnder = (node: ReactTestInstance | string): string =>
  typeof node === 'string'
    ? node
    : (node.children ?? []).map(textUnder).join('');

// Located by what it renders rather than by position, so an extra control in
// the header cannot silently retarget the assertion.
const pressableShowing = (tree: Renderer, label: string): ReactTestInstance => {
  const match = tree.root
    .findAll(node => typeof node.props?.onPress === 'function')
    .find(node => textUnder(node).includes(label));
  if (match == null) {
    throw new Error(`no pressable rendering ${label}`);
  }
  return match;
};

// Every polygon `points` string in the tree, which is how the SVG glyphs are
// distinguishable once react-native-svg has flattened colours to numbers.
const polygons = (tree: Renderer): string[] =>
  tree.root
    .findAll(node => typeof node.props?.points === 'string')
    .map(node => node.props.points as string);

const tileTints = (tree: Renderer): string[] =>
  tree.root
    .findAll(
      node =>
        typeof node.type === 'string' &&
        node.props?.style?.width === 42 &&
        typeof node.props?.style?.backgroundColor === 'string',
    )
    .map(node => node.props.style.backgroundColor as string);

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('SignsScreen', () => {
  it('renders a row for every category in the catalogue', async () => {
    const text = textUnder((await renderSigns()).root);

    for (const category of CATEGORIES) {
      expect(text).toContain(category.name);
      expect(text).toContain(category.subtitle);
    }
  });

  it('counts the signs in each category', async () => {
    const text = textUnder((await renderSigns()).root);

    expect(text).toContain('2 signs · rules you must obey');
    expect(text).toContain('1 signs · where you may stop');
  });

  // The point of the refactor: the glyph shape comes off the record, so a
  // category authored in the admin panel draws itself with no code change.
  it('draws the glyph each category asks for, including unseen ones', async () => {
    const tree = await renderSigns();
    const shapes = polygons(tree);

    // octagon
    expect(shapes).toContain('30,0 70,0 100,30 100,70 70,100 30,100 0,70 0,30');
    // pennant — no bundled category uses it
    expect(shapes).toContain('2,18 98,50 2,82');
    // circle is a plain View, tinted with the category's own colour
    expect(
      tree.root.findAll(
        node =>
          typeof node.type === 'string' &&
          node.props?.style?.[1]?.backgroundColor === '#1B7FD4',
      ),
    ).toHaveLength(1);
  });

  // Locks in the tint rule that replaced `category.id === 'warning'`: a light
  // colour gets 0.14, everything else 0.09, derived from the colour itself.
  it('tints each tile from the category colour', async () => {
    const tints = tileTints(await renderSigns());

    expect(tints).toEqual([
      'rgba(200, 16, 46, 0.09)',
      'rgba(201, 214, 79, 0.14)',
      'rgba(27, 127, 212, 0.09)',
    ]);
  });

  it('opens the category a row stands for', async () => {
    const tree = await renderSigns();
    await ReactTestRenderer.act(async () => {
      pressableShowing(tree, 'Parking').props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('SignCategory', {
      categoryId: 'parking',
    });
  });

  it('starts the signs quiz from the banner', async () => {
    const tree = await renderSigns();
    await ReactTestRenderer.act(async () => {
      pressableShowing(tree, 'Start').props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Quiz', { mode: 'signsQuiz' });
  });
});
