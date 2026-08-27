import type {
  CardStyleV2,
  CourseAssetV2,
  LessonBlockV2,
  LessonDocV2,
} from '@/data/course/v2/wire';
import {
  blockAssetIds,
  blockElements,
  blockStyleId,
  elementsToBullets,
  elementsToMarkdown,
  validateCourseDocV2,
  validateLessonDocV2,
} from '@/data/course/v2/wire';
import {
  CARD_META,
  cardMetaFor,
  checkpointMetaFor,
} from '@/components/lesson/cards';

// Authoring contract for PC-6: a slide's body is an ordered element list, a
// course may define its own slide types, and both must survive the validator
// the app runs over everything it downloads.

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const asset = (assetId: string, n: number): CourseAssetV2 => ({
  assetId,
  uuid: uuid(n),
  type: 'svg',
  width: 320,
  height: 180,
  alt: 'A diagram',
  sha256: 'a'.repeat(64),
  svgXml: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
});

const lessonDoc = (
  blocks: LessonBlockV2[],
  extra: Partial<LessonDocV2['lesson']> = {},
  assets: CourseAssetV2[] = [],
): unknown => ({
  schemaVersion: 2,
  deliveryVersion: '1.0.0',
  lesson: {
    lessonId: 'l-01',
    uuid: uuid(1),
    moduleId: 'm-01',
    globalSequence: 1,
    moduleSequence: 1,
    title: 'Lesson',
    objective: 'Learn it',
    estimatedMinutes: '5-7',
    format: 'scenario_first_cards',
    blocks,
    questionIds: [],
    assetIds: [],
    language: 'en',
    ...extra,
  },
  questions: [],
  assets,
});

const textBlock = (over: Record<string, unknown> = {}): LessonBlockV2 =>
  ({
    blockId: 'l-01-b01',
    type: 'core_rule',
    title: 'Stop at the line',
    bodyMarkdown: 'Stop before the line.',
    ...over,
  } as LessonBlockV2);

describe('slide bodies as element lists', () => {
  it('reads a legacy block as paragraphs followed by its bullets', () => {
    const block = textBlock({
      bodyMarkdown: 'First para.\n\nSecond para.',
      bullets: ['One', 'Two'],
    });

    expect(blockElements(block)).toEqual([
      { kind: 'paragraph', text: 'First para.' },
      { kind: 'paragraph', text: 'Second para.' },
      { kind: 'bullets', items: ['One', 'Two'] },
    ]);
  });

  it('prefers an authored content list over the legacy fields', () => {
    const block = textBlock({
      bodyMarkdown: 'ignored mirror',
      content: [
        { kind: 'paragraph', text: 'Intro.' },
        { kind: 'image', assetId: 'l-01-a01' },
        { kind: 'paragraph', text: 'Outro.' },
      ],
    });

    expect(blockElements(block).map(element => element.kind)).toEqual([
      'paragraph',
      'image',
      'paragraph',
    ]);
    expect(blockAssetIds(block)).toEqual(['l-01-a01']);
  });

  it('flattens an element list back to the legacy fields', () => {
    const elements = blockElements(
      textBlock({
        content: [
          { kind: 'paragraph', text: 'A.' },
          { kind: 'image', assetId: 'l-01-a01' },
          { kind: 'bullets', items: ['x', 'y'] },
          { kind: 'paragraph', text: 'B.' },
        ],
      }),
    );

    expect(elementsToMarkdown(elements)).toBe('A.\n\nB.');
    expect(elementsToBullets(elements)).toEqual(['x', 'y']);
  });

  it('keeps an element kind it does not know instead of dropping it', () => {
    const result = validateLessonDocV2(
      lessonDoc([
        textBlock({
          content: [
            { kind: 'paragraph', text: 'A.' },
            { kind: 'video', src: 'later' },
          ],
        }),
      ]),
    );

    expect(result.ok).toBe(true);
    const content = (
      result.value!.lesson.blocks[0] as { content: { kind: string }[] }
    ).content;
    expect(content.map(element => element.kind)).toEqual([
      'paragraph',
      'video',
    ]);
  });
});

describe('inline artwork', () => {
  it('accepts an inline image whose asset the lesson lists', () => {
    const result = validateLessonDocV2(
      lessonDoc(
        [
          textBlock({
            content: [
              { kind: 'paragraph', text: 'A.' },
              { kind: 'image', assetId: 'l-01-a01' },
            ],
          }),
        ],
        { assetIds: ['l-01-a01'] },
        [asset('l-01-a01', 2)],
      ),
    );

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('rejects an inline image the lesson never declared', () => {
    const result = validateLessonDocV2(
      lessonDoc([
        textBlock({
          content: [{ kind: 'image', assetId: 'l-01-a09' }],
        }),
      ]),
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain(
      'references asset l-01-a09 outside lesson.assetIds',
    );
  });

  it('lets a body of pure artwork flatten to no prose at all', () => {
    const result = validateLessonDocV2(
      lessonDoc(
        [
          textBlock({
            bodyMarkdown: '',
            content: [{ kind: 'image', assetId: 'l-01-a01' }],
          }),
        ],
        { assetIds: ['l-01-a01'] },
        [asset('l-01-a01', 2)],
      ),
    );

    expect(result.errors).toEqual([]);
  });

  it('still requires prose from a block that authored no content', () => {
    const result = validateLessonDocV2(
      lessonDoc([textBlock({ bodyMarkdown: '' })]),
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('bodyMarkdown');
  });
});

describe('slide types', () => {
  const courseDoc = (cardStyles?: unknown): unknown => ({
    schemaVersion: 2,
    deliveryVersion: '1.0.0',
    course: {
      courseId: 'ca-class-c',
      title: 'Course',
      subtitle: 'Sub',
      jurisdiction: 'US-CA',
      state: 'California',
      language: 'en',
      targetLicense: 'Class C',
      moduleIds: ['m-01'],
      ...(cardStyles !== undefined && { cardStyles }),
      sourceVersionLabel: 'CA-1',
      sourceContentHash: 'x',
      sourceCheckedAt: '2026-01-01',
      sourceReviewStatus: 'draft',
      publicationAuthorized: false,
    },
  });

  it('accepts a course that ships no slide types at all', () => {
    const result = validateCourseDocV2(courseDoc());
    expect(result.ok).toBe(true);
    expect(result.value!.course.cardStyles).toBeUndefined();
  });

  it('accepts authored types and rejects a colour that is not a hex value', () => {
    const good = validateCourseDocV2(
      courseDoc([
        {
          styleId: 'road_hazard',
          label: 'Road hazard',
          icon: 'triangle-exclamation',
          tone: 'trap',
          textColor: '#B45309',
          iconColor: '#D97706',
        },
      ]),
    );
    expect(good.errors).toEqual([]);

    const bad = validateCourseDocV2(
      courseDoc([
        {
          styleId: 'road_hazard',
          label: 'Road hazard',
          icon: 'check',
          textColor: 'red',
        },
      ]),
    );
    expect(bad.ok).toBe(false);
    expect(bad.errors.join(' ')).toContain('textColor');
  });

  it('rejects two types claiming the same id', () => {
    const result = validateCourseDocV2(
      courseDoc([
        { styleId: 'core_rule', label: 'A', icon: 'check' },
        { styleId: 'core_rule', label: 'B', icon: 'check' },
      ]),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('duplicate style ids');
  });

  it('reads the style a block asks for, falling back to its own family', () => {
    expect(blockStyleId(textBlock())).toBe('core_rule');
    expect(blockStyleId(textBlock({ styleId: 'road_hazard' }))).toBe(
      'road_hazard',
    );
  });

  it('draws a block through the style it names', () => {
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

    const meta = cardMetaFor(
      textBlock({ styleId: 'road_hazard' }),
      'California',
      styles,
    );

    expect(meta).toEqual({
      label: 'Road hazard',
      icon: 'triangle-exclamation',
      tone: 'trap',
      textColor: '#B45309',
      iconColor: '#D97706',
    });
  });

  it('overrides a built-in family for every card of that family', () => {
    const meta = cardMetaFor(textBlock(), 'California', [
      { styleId: 'core_rule', label: 'The rule', icon: 'bookmark' },
    ]);

    expect(meta.label).toBe('The rule');
    expect(meta.icon).toBe('bookmark');
    // No tone of its own, so the built-in one stands.
    expect(meta.tone).toBe(CARD_META.core_rule.tone);
  });

  it('ignores an icon name this build does not have rather than blanking it', () => {
    const meta = cardMetaFor(textBlock(), 'California', [
      { styleId: 'core_rule', label: 'The rule', icon: 'rocket-ship' },
    ]);

    expect(meta.icon).toBe(CARD_META.core_rule.icon);
  });

  it('keeps the state name in an unstyled state_specific kicker', () => {
    const meta = cardMetaFor(
      textBlock({ type: 'state_specific' }),
      'Florida',
      [],
    );
    expect(meta.label).toBe('Florida specific');
  });

  it('lets the checkpoint card be styled through its reserved id', () => {
    expect(checkpointMetaFor([]).label).toBe(CARD_META.core_rule.label);
    expect(
      checkpointMetaFor([
        { styleId: 'checkpoint', label: 'Quick check', icon: 'check' },
      ]).label,
    ).toBe('Quick check');
  });
});
