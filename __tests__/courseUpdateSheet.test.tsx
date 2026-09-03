import React from 'react';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import CourseUpdateSheet from '@/components/CourseUpdateSheet';
import type { UpdateCost } from '@/components/CourseUpdateSheet';
import { defaultTheme } from '@/theme';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

// The three sheets a course update raises. Each one has to say the same
// things in the same order — what happened, in whose words, and what it
// costs — and the destructive one has to count the cost in the learner's own
// numbers before it asks.

const render = async (
  props: Partial<React.ComponentProps<typeof CourseUpdateSheet>> = {},
): Promise<Renderer> => {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <CourseUpdateSheet
          visible
          variant="apology"
          eyebrow="WE GOT SOMETHING WRONG"
          title="We fixed 2 lessons you had finished"
          body="Two answers were wrong."
          points={['One', 'Two', 'Three']}
          primaryLabel="Redo the 2 lessons"
          onPrimary={() => undefined}
          secondaryLabel="Not now"
          onSecondary={() => undefined}
          {...props}
        />
      </ThemeProvider>,
    );
  });
  return tree;
};

const textsOf = (tree: Renderer): string =>
  tree.root
    .findAll(node => String(node.type) === 'Text')
    .map(node => node.children.filter(c => typeof c === 'string').join(''))
    .join(' | ');

const press = async (tree: Renderer, label: string): Promise<void> => {
  const target = tree.root.findAll(
    node =>
      typeof node.type !== 'string' &&
      typeof node.props.onPress === 'function' &&
      (node.props.accessibilityLabel === label || node.props.label === label),
  );
  expect(target.length).toBeGreaterThan(0);
  await ReactTestRenderer.act(async () => {
    target[target.length - 1].props.onPress();
  });
};

const COST: UpdateCost = {
  lessonsDone: 7,
  points: 508,
  bestExam: 82,
  note: 'You start again from the first lesson.',
  keeps: 'Your day streak stays with you.',
};

it('leads with the release’s own words, then what it did', async () => {
  const texts = textsOf(await render());
  expect(texts).toContain('WE GOT SOMETHING WRONG');
  expect(texts).toContain('We fixed 2 lessons you had finished');
  expect(texts).toContain('Two answers were wrong.');
  // The three reassurance lines, in order.
  expect(texts).toContain('One | Two | Three');
});

it('offers the redo and a way out, and both are pressable', async () => {
  const onPrimary = jest.fn();
  const onSecondary = jest.fn();
  const tree = await render({ onPrimary, onSecondary });

  await press(tree, 'Redo the 2 lessons');
  expect(onPrimary).toHaveBeenCalledTimes(1);
  await press(tree, 'Not now');
  expect(onSecondary).toHaveBeenCalledTimes(1);
});

it('counts what an offer costs in the learner’s own numbers', async () => {
  const texts = textsOf(
    await render({
      variant: 'offer',
      eyebrow: 'COURSE VERSION 4.0.0 AVAILABLE',
      title: 'A rebuilt course is ready',
      body: 'Every explanation rewritten.',
      points: undefined,
      cost: COST,
      primaryLabel: 'Update and reset my progress',
      secondaryLabel: 'Keep my current course',
    }),
  );
  expect(texts).toContain('COURSE VERSION 4.0.0 AVAILABLE');
  expect(texts).toContain('Updating erases everything below');
  // The numbers, each under its own label.
  expect(texts).toContain('7 | Lessons done');
  expect(texts).toContain('508 | Points');
  expect(texts).toContain('82% | Best exam');
  expect(texts).toContain('You start again from the first lesson.');
  // And what survives it, which is the reason to say it at all.
  expect(texts).toContain('Your day streak stays with you.');
  expect(texts).toContain('Keep my current course');
});

it('leaves out a best exam nobody has sat', async () => {
  const texts = textsOf(
    await render({
      variant: 'offer',
      points: undefined,
      cost: { ...COST, bestExam: null },
      primaryLabel: 'Update and reset my progress',
      secondaryLabel: 'Keep my current course',
    }),
  );
  expect(texts).not.toContain('Best exam');
  expect(texts).toContain('7 | Lessons done');
});

it('hands its Modal the dismissal callback the accept flow waits on', async () => {
  // iOS goes black if the download overlay presents while this sheet is
  // still dismissing; SyncManager sequences the two through onDismissed.
  const onDismissed = jest.fn();
  const tree = await render({ onDismissed });
  const modal = tree.root.findByType(require('react-native').Modal);
  expect(modal.props.onDismiss).toBe(onDismissed);
});

it('holds a destructive button behind its countdown', async () => {
  jest.useFakeTimers();
  const onPrimary = jest.fn();
  const tree = await render({ armSeconds: 5, onPrimary });
  const button = () =>
    tree.root.findAll(
      node =>
        typeof node.type !== 'string' &&
        typeof node.props.onPress === 'function' &&
        /^Redo the 2 lessons/.test(String(node.props.accessibilityLabel ?? '')),
    )[0];

  expect(button().props.accessibilityState).toEqual({ disabled: true });
  expect(button().props.accessibilityLabel).toBe('Redo the 2 lessons · 5');

  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(button().props.accessibilityLabel).toBe('Redo the 2 lessons · 3');

  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(3000);
  });
  expect(button().props.accessibilityState).toEqual({ disabled: false });
  expect(button().props.accessibilityLabel).toBe('Redo the 2 lessons');
  jest.useRealTimers();
});

it('shows nothing at all when it is not its turn', async () => {
  const tree = await render({ visible: false });
  expect(tree.root.findAll(node => String(node.type) === 'Text').length).toBe(
    0,
  );
});
