import React from 'react';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import ProgressTrack from '@/components/ProgressTrack';
import { defaultTheme } from '@/theme';

// The `marks` dots are a design option no screen currently passes — this
// keeps the option working for whenever it is switched on.

const render = async (marks?: number[]): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <ProgressTrack progress={0.5} marks={marks} />
      </ThemeProvider>,
    );
  });
  return tree;
};

// Host views only — findAll also returns the styled composites wrapping each
// host view, which would over-count the dots.
const dotsOf = (tree: Renderer) =>
  tree.root.findAll(
    node =>
      String(node.type) === 'View' && node.props.testID === 'progress-mark',
  );

describe('progress track marks', () => {
  it('renders a dot per mark when the option is passed', async () => {
    const tree = await render([0.25, 0.75]);
    expect(dotsOf(tree).length).toBe(2);
  });

  it('renders no dots by default', async () => {
    const tree = await render();
    expect(dotsOf(tree).length).toBe(0);
  });
});
