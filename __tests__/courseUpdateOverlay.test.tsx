import React from 'react';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import CourseUpdateOverlay, {
  CourseUpdatePhase,
} from '@/components/CourseUpdateOverlay';
import { defaultTheme } from '@/theme';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// The overlay itself: a download in flight and how it ended. The offer that
// starts one is its own sheet (courseUpdateSheet.test.tsx), and the manager
// driving both is exercised through the lazy store's tests.

const render = async (phase: CourseUpdatePhase): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <CourseUpdateOverlay phase={phase} progress={0.5} />
      </ThemeProvider>,
    );
  });
  return tree;
};

const textsOf = (tree: Renderer): string[] =>
  tree.root
    .findAll(node => String(node.type) === 'Text')
    .map(node => node.children.join(''));

it('renders nothing while idle', async () => {
  const tree = await render('idle');
  expect(tree.toJSON()).toBeNull();
});

it('owns up to an interrupted update instead of vanishing', async () => {
  const texts = textsOf(await render('failed'));
  expect(texts.join(' ')).toContain('Update interrupted');
  expect(texts.join(' ')).toContain('Your course is untouched');
});

it('leaves the offer to the sheet that can say what it costs', async () => {
  const tree = await render('offer');
  expect(tree.toJSON()).toBeNull();
});
