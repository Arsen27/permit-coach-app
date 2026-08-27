import React from 'react';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import CourseAssetView from '@/components/CourseAssetView';
import type { Diagram } from '@/components/CourseAssetView';
import { defaultTheme } from '@/theme';

// Lesson images span the full available width whatever their shape: the
// frame takes the asset's own aspect ratio, so a portrait photo grows tall
// instead of being letterboxed into 16:9.

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>';

const render = async (asset: Diagram): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <CourseAssetView asset={asset} />
      </ThemeProvider>,
    );
  });
  return tree;
};

const frameRatioOf = (tree: Renderer): number | undefined => {
  const frame = tree.root.findAll(
    node =>
      String(node.type) === 'View' && node.props.accessibilityRole === 'image',
  )[0];
  return [frame.props.style]
    .flat(Infinity)
    .map(style => (style as { aspectRatio?: number } | null)?.aspectRatio)
    .find(value => value != null);
};

describe('course asset frame', () => {
  it('takes the aspect ratio of a portrait asset', async () => {
    const tree = await render({
      svgXml: SVG,
      alt: 'portrait photo',
      width: 600,
      height: 800,
    });
    expect(frameRatioOf(tree)).toBeCloseTo(0.75);
  });

  it('keeps 16:9 for registry art without a size', async () => {
    const tree = await render({ svgXml: SVG, alt: 'diagram' });
    expect(frameRatioOf(tree)).toBeCloseTo(16 / 9);
  });
});
