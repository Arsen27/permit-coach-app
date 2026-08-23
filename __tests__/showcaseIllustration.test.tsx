import React from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import ShowcaseScreen from '@/screens/onboarding/ShowcaseScreen';
import { defaultTheme } from '@/theme';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/data/course/CourseProvider', () => ({
  useCourse: () => ({ bundle: { course: { state: 'California' } } }),
}));

jest.mock('@/data/course/v2/wire', () => ({
  bundleLessonCount: () => 30,
}));

const render = async (index: number): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <ShowcaseScreen
          navigation={{ push: jest.fn() } as never}
          route={{ key: 's', name: 'Showcase', params: { index } } as never}
        />
      </ThemeProvider>,
    );
  });
  return tree;
};

// Regression for the bug where the illustration rendered at its intrinsic
// pixel size (1170×1264pt, swallowing the whole screen). Two rules follow
// from it:
// - the height must be an explicit computed number (relative to the screen
//   width and the asset's proportions), never the asset's own pixel size;
// - the style must NOT contain aspectRatio at all — on RN 0.86's new
//   architecture an Image style with aspectRatio is ignored wholesale
//   (width included) and the view falls back to intrinsic size.
describe('showcase illustration sizing', () => {
  [0, 1, 2].forEach(index => {
    it(`slide ${index + 1} uses full width and a computed height`, async () => {
      const tree = await render(index);
      const images = tree.root.findAll(node => String(node.type) === 'Image');
      expect(images.length).toBeGreaterThan(0);

      const style = StyleSheet.flatten(images[0].props.style);
      expect(style.width).toBe('100%');
      expect(style.aspectRatio).toBeUndefined();
      expect(typeof style.height).toBe('number');
      expect(style.height).toBeGreaterThan(0);
      // Far below the asset's intrinsic 1264pt — proves the height is
      // derived from the window, not the pixel size.
      expect(style.height).toBeLessThan(1000);
    });
  });
});
