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

// The overlay itself: what each phase puts on screen. The manager driving it
// (SyncManager) is exercised through the lazy store's own tests — the sync,
// the prompt and the offer all come from there.

const render = async (
  phase: CourseUpdatePhase,
  offer: { version: string; notes?: string } | null = null,
): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <CourseUpdateOverlay
          phase={phase}
          progress={0.5}
          offer={offer}
          onAcceptOffer={() => undefined}
          onDeclineOffer={() => undefined}
        />
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

it('shows the offer with its notes and the fresh-start warning', async () => {
  const texts = textsOf(
    await render('offer', {
      version: '2.0.0',
      notes: 'A brand-new course for 2027.',
    }),
  );
  expect(texts.join(' ')).toContain('A new course is ready');
  expect(texts.join(' ')).toContain('A brand-new course for 2027.');
  expect(texts.join(' ')).toMatch(/progress .*(erased|start)/i);
});
