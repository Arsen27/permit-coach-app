import React from 'react';
import ReactTestRenderer, {
  ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { ThemeProvider } from 'styled-components/native';

import CourseAssetView from '@/components/CourseAssetView';
import Icon from '@/components/Icon';
import LessonCardBody from '@/components/lesson/LessonCardBody';
import { buildCards } from '@/components/lesson/cards';
import type {
  CardStyleV2,
  CourseAssetV2,
  CourseLessonV2,
  LessonBlockV2,
} from '@/data/course/v2/wire';
import { defaultTheme } from '@/theme';

// What the learner actually sees once a slide carries an element body and the
// course styles its own slide types. The admin previews lessons through this
// same component, so a pass here is a pass for both.

const artwork = (assetId: string): CourseAssetV2 => ({
  assetId,
  uuid: '0b9e4c7a-8f21-4d5e-9a3b-2c1d0e9f8a7b',
  type: 'svg',
  width: 320,
  height: 180,
  alt: `Diagram ${assetId}`,
  sha256: 'a'.repeat(64),
  svgXml: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
});

const lessonOf = (blocks: LessonBlockV2[]): CourseLessonV2 => ({
  lessonId: 'l-01',
  uuid: '0b9e4c7a-8f21-4d5e-9a3b-2c1d0e9f8a7c',
  moduleId: 'm-01',
  globalSequence: 1,
  moduleSequence: 1,
  title: 'Lesson',
  objective: 'Learn it',
  estimatedMinutes: '5',
  format: 'cards',
  blocks,
  questionIds: [],
  assetIds: [],
  language: 'en',
});

const render = (
  block: LessonBlockV2,
  options: {
    cardStyles?: CardStyleV2[];
    assets?: CourseAssetV2[];
  } = {},
): Renderer => {
  const cards = buildCards(lessonOf([block]));
  const assets = new Map(
    (options.assets ?? []).map(asset => [asset.assetId, asset]),
  );
  let tree!: Renderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <ThemeProvider theme={defaultTheme}>
        <LessonCardBody
          card={cards[cards.length - 1]}
          onSelect={() => {}}
          stateLabel="California"
          cardStyles={options.cardStyles}
          resolveAsset={assetId => assets.get(assetId)}
        />
      </ThemeProvider>,
    );
  });
  return tree;
};

const textsOf = (tree: Renderer): string[] =>
  tree.root
    .findAll(node => typeof node.type === 'string' && node.children.length > 0)
    .flatMap(node => node.children.filter(child => typeof child === 'string'))
    .map(String);

describe('a slide body drawn from its elements', () => {
  it('draws paragraphs, bullets and inline artwork in the authored order', () => {
    const tree = render(
      {
        blockId: 'l-01-b01',
        type: 'core_rule',
        title: 'Stop at the line',
        bodyMarkdown: 'Before.\n\nAfter.',
        content: [
          { kind: 'paragraph', text: 'Before.' },
          { kind: 'image', assetId: 'l-01-a01' },
          { kind: 'bullets', items: ['Look left', 'Look right'] },
          { kind: 'paragraph', text: 'After.' },
        ],
      } as LessonBlockV2,
      { assets: [artwork('l-01-a01')] },
    );

    const texts = textsOf(tree);
    expect(texts).toContain('Before.');
    expect(texts).toContain('Look left');
    expect(texts).toContain('After.');
    // The image sits between the two paragraphs, not ahead of the card.
    expect(texts.indexOf('Before.')).toBeLessThan(texts.indexOf('After.'));
    expect(tree.root.findAllByType(CourseAssetView)).toHaveLength(1);
  });

  it('draws more than one illustration on the same slide', () => {
    const tree = render(
      {
        blockId: 'l-01-b01',
        type: 'core_rule',
        title: 'Two diagrams',
        bodyMarkdown: 'Between.',
        content: [
          { kind: 'image', assetId: 'l-01-a01' },
          { kind: 'paragraph', text: 'Between.' },
          { kind: 'image', assetId: 'l-01-a02' },
        ],
      } as LessonBlockV2,
      { assets: [artwork('l-01-a01'), artwork('l-01-a02')] },
    );

    expect(tree.root.findAllByType(CourseAssetView)).toHaveLength(2);
  });

  it('draws a legacy body exactly as it always did', () => {
    const tree = render({
      blockId: 'l-01-b01',
      type: 'core_rule',
      title: 'Stop at the line',
      bodyMarkdown: 'One.\n\nTwo.',
      bullets: ['A bullet'],
    } as LessonBlockV2);

    const texts = textsOf(tree);
    expect(texts).toContain('One.');
    expect(texts).toContain('Two.');
    expect(texts).toContain('A bullet');
  });

  it('draws nothing for a line left blank', () => {
    const tree = render({
      blockId: 'l-01-b01',
      type: 'core_rule',
      title: 'Stop at the line',
      bodyMarkdown: 'One.',
      content: [
        { kind: 'paragraph', text: 'One.' },
        { kind: 'paragraph', text: '   ' },
        { kind: 'bullets', items: ['Kept', ''] },
      ],
    } as LessonBlockV2);

    const texts = textsOf(tree);
    expect(texts).toContain('One.');
    expect(texts).toContain('Kept');
    // No empty paragraph and no empty bullet left a gap behind.
    expect(texts.filter(value => value.trim().length === 0)).toEqual([]);
  });

  it('skips an element kind it does not know without losing the card', () => {
    const tree = render({
      blockId: 'l-01-b01',
      type: 'core_rule',
      title: 'Stop at the line',
      bodyMarkdown: 'Kept.',
      content: [
        { kind: 'video', src: 'later' },
        { kind: 'paragraph', text: 'Kept.' },
      ],
    } as unknown as LessonBlockV2);

    expect(textsOf(tree)).toContain('Kept.');
  });
});

describe('a course styling its own slide types', () => {
  const styles: CardStyleV2[] = [
    {
      styleId: 'road_hazard',
      label: 'Road hazard',
      icon: 'triangle-exclamation',
      tone: 'trap',
      textColor: '#B45309',
      iconColor: '#D97706',
    },
  ];

  const block = {
    blockId: 'l-01-b01',
    type: 'core_rule',
    styleId: 'road_hazard',
    title: 'Watch the shoulder',
    bodyMarkdown: 'Body.',
  } as LessonBlockV2;

  it('puts the authored label in the kicker', () => {
    expect(textsOf(render(block, { cardStyles: styles }))).toContain(
      'Road hazard',
    );
  });

  it('paints the kicker text and its icon in the authored colours', () => {
    const tree = render(block, { cardStyles: styles });

    const icon = tree.root.findAll(
      node => typeof node.type !== 'string' && node.props?.color === '#D97706',
    );
    expect(icon.length).toBeGreaterThan(0);

    const painted = JSON.stringify(tree.toJSON()).includes('#B45309');
    expect(painted).toBe(true);
  });

  it('draws a glyph the course shipped instead of a built-in one', () => {
    const glyph =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M2 2h12v12H2z" fill="currentColor"/></svg>';
    const tree = render(block, {
      cardStyles: [{ ...styles[0], iconSvg: glyph }],
    });

    // One Icon, drawing the course's glyph rather than a built-in name.
    const drawn = tree.root.findAllByType(Icon);
    expect(drawn).toHaveLength(1);
    expect(drawn[0].props.xml).toBe(glyph);
    // And it is tinted, because the glyph is drawn in currentColor.
    expect(drawn[0].props.color).toBe('#D97706');
  });

  it('falls back to the built-in kicker when the course styles nothing', () => {
    expect(textsOf(render(block))).toContain('Core rule');
  });
});
