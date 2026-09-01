import React from 'react';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import LessonCardBody from '@/components/lesson/LessonCardBody';
import type { LessonCard } from '@/components/lesson/cards';
import { defaultTheme } from '@/theme';

// The closing recap card. It is the line a learner carries away, so it is set
// large — but an author who wrote several points meant several points, and a
// paragraph at hero size is a wall rather than a takeaway.

const recap = (bodyMarkdown: string): LessonCard => ({
  key: 'b01',
  block: {
    blockId: 'b01',
    type: 'remember_this',
    title: 'Remember this',
    bodyMarkdown,
  },
});

const render = async (bodyMarkdown: string): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <LessonCardBody
          card={recap(bodyMarkdown)}
          stateLabel="California"
          cardStyles={[]}
          resolveAsset={() => undefined}
          onSelect={() => undefined}
          checkpointOrdinal={0}
          checkpointTotal={0}
          revealed={false}
        />
      </ThemeProvider>,
    );
  });
  return tree;
};

// styled-components stacks the testID through its wrappers, so only the
// native fibers count.
const cards = (tree: Renderer) =>
  tree.root.findAll(
    node => String(node.type) === 'View' && node.props.testID === 'recap-card',
  );

const sizeOf = (tree: Renderer): number | undefined => {
  const text = tree.root.findAll(
    node => String(node.type) === 'Text' && node.props.testID === 'recap-text',
  )[0];
  return [text.props.style]
    .flat(Infinity)
    .map(style => (style as { fontSize?: number } | null)?.fontSize)
    .filter((value): value is number => value != null)
    .pop();
};

const SHORT = 'Right of way is given, never taken.';
const LONG_ONE =
  'A yellow light means the signal is about to turn red, so stop if you ' +
  'can do it safely, and never speed up to beat it before it changes.';

it('a short closing line stays one card, set large', async () => {
  const tree = await render(SHORT);
  expect(cards(tree)).toHaveLength(1);
  expect(sizeOf(tree)).toBe(23);
});

it('several points become several cards once there is enough text', async () => {
  const tree = await render(`${LONG_ONE}\n\n${LONG_ONE}`);
  expect(cards(tree)).toHaveLength(2);
  // And the type comes down: a paragraph set at hero size is a wall.
  expect(sizeOf(tree)).toBe(19);
});

it('two short points still read better together', async () => {
  const tree = await render(`${SHORT}\n\nStop means stop.`);
  expect(cards(tree)).toHaveLength(1);
});

it('one long paragraph cannot be split, so it is only set smaller', async () => {
  const tree = await render(LONG_ONE);
  expect(cards(tree)).toHaveLength(1);
  expect(sizeOf(tree)).toBe(19);
});
