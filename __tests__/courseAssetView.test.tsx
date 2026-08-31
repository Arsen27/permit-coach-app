import React from 'react';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import { primeVectorsForTests, resetAssetsForTests } from '@/data/assets/store';
import CourseAssetView from '@/components/CourseAssetView';
import { sha256Hex, utf8ByteLength } from '@/lib/sha256';
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

describe('a picture that is not here yet', () => {
  it('holds the shape it will have, and says nothing', async () => {
    resetAssetsForTests();
    const asset = {
      assetId: 'a2',
      uuid: 'u2',
      mime: 'image/svg+xml' as const,
      width: 800,
      height: 600,
      alt: 'a diagram still downloading',
      sha256: sha256Hex('not on this device'),
      sizeBytes: 128,
    };
    let tree!: Renderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <ThemeProvider theme={defaultTheme}>
          <CourseAssetView asset={asset} />
        </ThemeProvider>,
      );
    });
    // The frame is already the picture's own shape, so the card does not
    // reflow when it lands — and no caption describes what is missing.
    expect(frameRatioOf(tree)).toBeCloseTo(800 / 600);
    expect(tree.root.findAll(node => String(node.type) === 'Text')).toEqual([]);
  });
});

describe('a stored picture', () => {
  it('draws from the device store without a placeholder', async () => {
    resetAssetsForTests();
    await primeVectorsForTests([[sha256Hex(SVG), SVG]]);

    const asset = {
      assetId: 'a1',
      uuid: 'u1',
      mime: 'image/svg+xml' as const,
      width: 800,
      height: 600,
      alt: 'stored diagram',
      sha256: sha256Hex(SVG),
      sizeBytes: utf8ByteLength(SVG),
    };
    let tree!: Renderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <ThemeProvider theme={defaultTheme}>
          <CourseAssetView asset={asset} />
        </ThemeProvider>,
      );
    });
    // The frame is there with the asset's own ratio, and no placeholder text.
    expect(frameRatioOf(tree)).toBeCloseTo(800 / 600);
    const texts = tree.root
      .findAll(node => String(node.type) === 'Text')
      .map(node => node.children.join(''));
    expect(texts.join(' ')).not.toContain('unavailable');
  });
});
