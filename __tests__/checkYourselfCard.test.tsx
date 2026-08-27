import React from 'react';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import LessonCardBody from '@/components/lesson/LessonCardBody';
import { CARD_META, buildCards } from '@/components/lesson/cards';
import type { CheckYourselfBlockV2 } from '@/data/course/v2/wire';
import {
  recallGapErrors,
  recallSegments,
  validateLessonDocV2,
} from '@/data/course/v2/wire';
import { defaultTheme } from '@/theme';

// The check-yourself recall card (lesson-card handoff screens 19/24): the
// rule's key words are blurred out until the host reveals them.

const RULE =
  'You may cross a solid yellow line to turn into a [[driveway]] — but never to [[pass]] another car.';

const block: CheckYourselfBlockV2 = {
  blockId: 'lesson-check-yourself-1',
  type: 'check_yourself',
  title: 'Can you finish the rule?',
  context: 'Recall · Yellow lines',
  ruleMarkdown: RULE,
};

const lessonDoc = (ruleMarkdown: string) => ({
  schemaVersion: 2,
  deliveryVersion: '1.0.0',
  lesson: {
    lessonId: 'test-lesson',
    uuid: '0b9e4c7a-8f21-4d5e-9a3b-2c1d0e9f8a7b',
    moduleId: 'test-module',
    globalSequence: 1,
    moduleSequence: 1,
    title: 'Road markings I',
    objective: 'Recall the yellow line rule.',
    estimatedMinutes: '5',
    format: 'cards',
    blocks: [{ ...block, ruleMarkdown }],
    questionIds: [],
    assetIds: [],
    language: 'en',
  },
  questions: [],
  assets: [],
});

describe('recall gap markers', () => {
  it('splits the rule into text and gap segments', () => {
    expect(recallSegments(RULE)).toEqual([
      {
        text: 'You may cross a solid yellow line to turn into a ',
        gap: false,
      },
      { text: 'driveway', gap: true },
      { text: ' — but never to ', gap: false },
      { text: 'pass', gap: true },
      { text: ' another car.', gap: false },
    ]);
  });

  it('accepts a well-formed rule', () => {
    expect(recallGapErrors(RULE)).toEqual([]);
  });

  it('rejects a rule with no gaps, empty gaps or unbalanced markers', () => {
    expect(recallGapErrors('No gaps at all.')).toEqual([
      'expected at least one [[gap]] marker',
    ]);
    expect(recallGapErrors('An [[]] empty gap.')).toContain(
      'empty [[gap]] marker',
    );
    expect(recallGapErrors('An [[unclosed gap.')).toContain(
      'unbalanced [[gap]] markers',
    );
    expect(recallGapErrors('A [[nested [[gap]] here]].')).toContain(
      'unbalanced [[gap]] markers',
    );
  });
});

describe('check_yourself wire validation', () => {
  it('accepts a valid block inside a lesson doc', () => {
    const result = validateLessonDocV2(lessonDoc(RULE));
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.value!.lesson.blocks[0]).toMatchObject({
      type: 'check_yourself',
      context: 'Recall · Yellow lines',
    });
  });

  it('rejects a rule without gap markers', () => {
    const result = validateLessonDocV2(lessonDoc('A rule with no gaps.'));
    expect(result.ok).toBe(false);
    expect(
      result.errors.some(error =>
        error.includes('expected at least one [[gap]] marker'),
      ),
    ).toBe(true);
  });
});

describe('check_yourself card rendering', () => {
  const card = buildCards({
    ...lessonDoc(RULE).lesson,
    blocks: [block],
  })[0];

  const render = async (revealed: boolean): Promise<Renderer> => {
    let tree!: Renderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <ThemeProvider theme={defaultTheme}>
          <LessonCardBody
            card={card}
            onSelect={() => {}}
            stateLabel="California"
            revealed={revealed}
          />
        </ThemeProvider>,
      );
    });
    return tree;
  };

  const textsOf = (tree: Renderer): string[] =>
    tree.root
      .findAll(node => String(node.type) === 'Text' && node.children.length > 0)
      .map(node =>
        node.children
          .map(child => (typeof child === 'string' ? child : ''))
          .join(''),
      );

  it('uses the accent check kicker', () => {
    expect(CARD_META.check_yourself).toEqual({
      label: 'Check yourself',
      icon: 'check',
      tone: 'accent',
    });
  });

  // The cover hiding each gap word (jest runs the no-glass fallback: an
  // opaque pill whose animated opacity says which state the gap shows).
  // Host views only — findAll also returns the styled/Animated composites
  // wrapping each host view, which would over-count the layers.
  const covers = (tree: Renderer) =>
    tree.root.findAll(
      node =>
        String(node.type) === 'View' && node.props.testID === 'recall-cover',
    );

  const opacityOf = (node: {
    props: { style?: unknown };
  }): number | undefined => {
    const opacity = [node.props.style]
      .flat(Infinity)
      .map(style => (style as { opacity?: unknown } | null)?.opacity)
      .find(value => value != null);
    return typeof opacity === 'number'
      ? opacity
      : (opacity as { __getValue: () => number } | undefined)?.__getValue();
  };

  it('covers the gap words until revealed', async () => {
    const tree = await render(false);
    const texts = textsOf(tree);
    expect(texts).toContain('Check yourself');
    expect(texts).toContain('Can you finish the rule?');
    expect(texts).toContain('Recall · Yellow lines');
    expect(texts).toContain(
      'The words are there — can you read them from memory?',
    );
    // The word is always mounted beneath the cover (so revealing never
    // reflows the sentence), flanked by its two blur-ghost copies.
    const driveway = tree.root.findAll(
      node =>
        String(node.type) === 'Text' &&
        node.children.length === 1 &&
        node.children[0] === 'driveway',
    );
    expect(driveway.length).toBe(3);
    // Hidden: one fully visible cover per gap.
    expect(covers(tree).map(opacityOf)).toEqual([1, 1]);
  });

  it('shows the words and the self-check helper once revealed', async () => {
    const tree = await render(true);
    const texts = textsOf(tree);
    expect(texts).toContain(
      'Just a self-check — either answer moves you forward.',
    );
    // Revealed: the covers are faded out and the word carries the pill.
    expect(covers(tree).map(opacityOf)).toEqual([0, 0]);
    const pass = tree.root.findAll(
      node =>
        String(node.type) === 'Text' &&
        node.children.length === 1 &&
        node.children[0] === 'pass',
    );
    expect(
      pass.some(node =>
        [node.props.style]
          .flat(Infinity)
          .some(style => style != null && style.color === '#ffffff'),
      ),
    ).toBe(true);
  });
});
