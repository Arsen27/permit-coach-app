import assert from 'node:assert/strict';
import { test } from 'node:test';

// Must come before any admin store: they are browser modules.
import './browserEnv.mts';

import type {
  CourseAssetV2,
  CourseQuestionV2,
  LessonBlockV2,
  LessonDocV2,
} from '../../src/data/course/v2/wire.ts';
import {
  blockElements,
  blockStyleId,
  cardStylesSvgBytes,
  withoutBlankElements,
} from '../../src/data/course/v2/wire.ts';
import {
  followsCurrentColor,
  minifySvg,
  paintsItself,
  tintedIcon,
  toCurrentColor,
} from '../src/model/svg.js';
import {
  bodyRows,
  customSlideTypes,
  lessonSlides,
  moveRow,
  reconcileReferences,
  rowsToElements,
  slideTypesOf,
  withElements,
  withSlideMoved,
} from '../src/model/slides.js';
import { useEdit } from '../src/store/editStore.js';

// The editor promises three things the wire format cannot check on its own:
// slides move as whole cards, converting a slide leaves nothing dangling, and
// a body edited as elements keeps its legacy mirror honest.

const image = (blockId: string, assetId: string): LessonBlockV2 => ({
  blockId,
  type: 'image',
  assetId,
});

const text = (blockId: string, over: Record<string, unknown> = {}) =>
  ({
    blockId,
    type: 'core_rule',
    title: blockId,
    bodyMarkdown: 'Body.',
    ...over,
  } as LessonBlockV2);

const asset = (assetId: string): CourseAssetV2 => ({
  assetId,
  uuid: '0b9e4c7a-8f21-4d5e-9a3b-2c1d0e9f8a7b',
  type: 'svg',
  width: 320,
  height: 180,
  alt: 'Diagram',
  sha256: 'a'.repeat(64),
  svgXml: '<svg></svg>',
});

const question = (questionId: string): CourseQuestionV2 => ({
  questionId,
  uuid: '0b9e4c7a-8f21-4d5e-9a3b-2c1d0e9f8a7c',
  kind: 'lesson_checkpoint',
  prompt: 'Prompt?',
  choices: [
    { id: 'A', text: 'A', feedback: '' },
    { id: 'B', text: 'B', feedback: '' },
    { id: 'C', text: 'C', feedback: '' },
  ],
  correctAnswerId: 'A',
  explanation: 'Because.',
});

const doc = (
  blocks: LessonBlockV2[],
  over: Partial<LessonDocV2> = {},
): LessonDocV2 => ({
  schemaVersion: 2,
  deliveryVersion: '1.0.0',
  lesson: {
    lessonId: 'l-01',
    uuid: '0b9e4c7a-8f21-4d5e-9a3b-2c1d0e9f8a7d',
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
    ...over.lesson,
  },
  questions: over.questions ?? [],
  assets: over.assets ?? [],
});

const begin = (document: LessonDocV2) =>
  useEdit.getState().begin({
    courseId: 'ca-class-c',
    draftId: 'd-1',
    versionKey: 'draft/d-1',
    doc: document,
  });

const draft = (): LessonDocV2 => useEdit.getState().draft!;

// ---------------------------------------------------------------------------
// Grouping and ordering

test('a folded image and the block it introduces are one slide', () => {
  const blocks = [image('b01', 'a01'), text('b02'), text('b03')];
  const slides = lessonSlides(blocks);

  assert.deepEqual(
    slides.map(slide => [slide.blockId, slide.blockIds]),
    [
      ['b02', ['b01', 'b02']],
      ['b03', ['b03']],
    ],
  );
  assert.equal(slides[0].leadingAssetId, 'a01');
});

test('only the last image of a run folds — the rest are cards of their own', () => {
  const slides = lessonSlides([
    image('b01', 'a01'),
    image('b02', 'a02'),
    text('b03'),
  ]);

  assert.deepEqual(
    slides.map(slide => slide.blockId),
    ['b01', 'b03'],
  );
  assert.equal(slides[1].leadingAssetId, 'a02');
});

test('a trailing image stands alone', () => {
  const slides = lessonSlides([text('b01'), image('b02', 'a01')]);
  assert.deepEqual(
    slides.map(slide => slide.blockId),
    ['b01', 'b02'],
  );
});

test('moving a slide carries its folded image with it', () => {
  const blocks = [text('b01'), image('b02', 'a01'), text('b03')];
  const moved = withSlideMoved(blocks, 'b03', -1);

  assert.deepEqual(
    moved.map(block => block.blockId),
    ['b02', 'b03', 'b01'],
  );
  // Still the same two slides, in the other order.
  assert.deepEqual(
    lessonSlides(moved).map(slide => slide.blockId),
    ['b03', 'b01'],
  );
});

test('moving off either end leaves the order untouched', () => {
  const blocks = [text('b01'), text('b02')];
  assert.deepEqual(withSlideMoved(blocks, 'b01', -1), blocks);
  assert.deepEqual(withSlideMoved(blocks, 'b02', 1), blocks);
});

// ---------------------------------------------------------------------------
// Bodies

test('writing elements keeps bodyMarkdown and bullets a true flattening', () => {
  const block = withElements(text('b01'), [
    { kind: 'paragraph', text: 'One.' },
    { kind: 'image', assetId: 'a01' },
    { kind: 'bullets', items: ['x', 'y'] },
    { kind: 'paragraph', text: 'Two.' },
  ]);

  assert.equal(
    (block as { bodyMarkdown: string }).bodyMarkdown,
    'One.\n\nTwo.',
  );
  assert.deepEqual((block as { bullets: string[] }).bullets, ['x', 'y']);
});

test('dropping the last bullet list drops the bullets field entirely', () => {
  const withBullets = withElements(text('b01'), [
    { kind: 'paragraph', text: 'One.' },
    { kind: 'bullets', items: ['x'] },
  ]);
  const without = withElements(withBullets, [
    { kind: 'paragraph', text: 'One.' },
  ]);

  assert.equal('bullets' in (without as object), false);
});

// ---------------------------------------------------------------------------
// Rows
//
// The editor is a line editor; the wire format groups bullets. Everything below
// is about that boundary holding in both directions.

test('a bullets element becomes one row per item', () => {
  assert.deepEqual(
    bodyRows([
      { kind: 'paragraph', text: 'Intro.' },
      { kind: 'bullets', items: ['x', 'y'] },
      { kind: 'image', assetId: 'a01' },
    ]),
    [
      { kind: 'paragraph', text: 'Intro.' },
      { kind: 'bullet', text: 'x' },
      { kind: 'bullet', text: 'y' },
      { kind: 'image', assetId: 'a01' },
    ],
  );
});

test('adjacent bullet rows merge back into one element', () => {
  assert.deepEqual(
    rowsToElements([
      { kind: 'bullet', text: 'x' },
      { kind: 'bullet', text: 'y' },
      { kind: 'paragraph', text: 'Between.' },
      { kind: 'bullet', text: 'z' },
    ]),
    [
      { kind: 'bullets', items: ['x', 'y'] },
      { kind: 'paragraph', text: 'Between.' },
      { kind: 'bullets', items: ['z'] },
    ],
  );
});

test('an unknown element survives the trip through rows', () => {
  const odd = { kind: 'video', src: 'later' } as never;
  assert.deepEqual(rowsToElements(bodyRows([odd])), [odd]);
});

test('an emptied body keeps one line to type into', () => {
  assert.deepEqual(rowsToElements([]), [{ kind: 'paragraph', text: '' }]);
});

test('moving a row lands it in the slot that was pointed at', () => {
  const rows = bodyRows([
    { kind: 'paragraph', text: 'a' },
    { kind: 'paragraph', text: 'b' },
    { kind: 'paragraph', text: 'c' },
  ]);
  // Dropped above the first row.
  assert.deepEqual(
    moveRow(rows, 2, 0).map(row => (row as { text: string }).text),
    ['c', 'a', 'b'],
  );
  // Dropped below the last row.
  assert.deepEqual(
    moveRow(rows, 0, 3).map(row => (row as { text: string }).text),
    ['b', 'c', 'a'],
  );
  // Dropped where it already is.
  assert.deepEqual(moveRow(rows, 1, 1), rows);
});

test('dragging a bullet out of its list splits the element', () => {
  begin(
    doc([
      withElements(text('b01'), [
        { kind: 'paragraph', text: 'Intro.' },
        { kind: 'bullets', items: ['x', 'y'] },
      ]),
    ]),
  );
  // Rows: [Intro.] [x] [y] — move the last bullet above the paragraph.
  useEdit.getState().moveRowTo('b01', 2, 0);

  assert.deepEqual(blockElements(draft().lesson.blocks[0]), [
    { kind: 'bullets', items: ['y'] },
    { kind: 'paragraph', text: 'Intro.' },
    { kind: 'bullets', items: ['x'] },
  ]);
});

test('a blank line is kept while typing and dropped on the way out', () => {
  const elements = [
    { kind: 'paragraph', text: 'Kept.' },
    { kind: 'paragraph', text: '   ' },
    { kind: 'bullets', items: ['x', '', ' '] },
    { kind: 'bullets', items: ['  '] },
  ] as never[];

  assert.deepEqual(withoutBlankElements(elements), [
    { kind: 'paragraph', text: 'Kept.' },
    { kind: 'bullets', items: ['x'] },
  ]);
  // Nothing to drop means the very same array back, so a save can skip work.
  const clean = [{ kind: 'paragraph', text: 'Kept.' }] as never[];
  assert.equal(withoutBlankElements(clean), clean);
});

test('the legacy mirror never carries a blank line', () => {
  const block = withElements(text('b01'), [
    { kind: 'paragraph', text: 'One.' },
    { kind: 'paragraph', text: '' },
    { kind: 'bullets', items: ['x', ''] },
  ]);

  assert.equal((block as { bodyMarkdown: string }).bodyMarkdown, 'One.');
  assert.deepEqual((block as { bullets: string[] }).bullets, ['x']);
});

// ---------------------------------------------------------------------------
// Reconciliation

test('a removed inline image takes its asset out of the document', () => {
  const document = doc(
    [
      withElements(text('b01'), [
        { kind: 'paragraph', text: 'One.' },
        { kind: 'image', assetId: 'a01' },
      ]),
    ],
    { assets: [asset('a01')] },
  );
  document.lesson.assetIds = ['a01'];

  document.lesson.blocks[0] = withElements(document.lesson.blocks[0], [
    { kind: 'paragraph', text: 'One.' },
  ]);
  reconcileReferences(document);

  assert.deepEqual(document.lesson.assetIds, []);
  assert.deepEqual(document.assets, []);
});

test('a question the scored test still owns survives a block being removed', () => {
  const document = doc([text('b01', { checkpointQuestionId: 'q01' })], {
    questions: [question('q01'), question('q02')],
  });
  document.lesson.questionIds = ['q01', 'q02'];
  document.lesson.theoryQuestionIds = ['q01'];
  document.lesson.testQuestionIds = ['q02'];

  document.lesson.blocks = [text('b01')];
  reconcileReferences(document);

  assert.deepEqual(document.lesson.questionIds, ['q02']);
  assert.deepEqual(document.lesson.theoryQuestionIds, []);
  assert.deepEqual(
    document.questions.map(item => item.questionId),
    ['q02'],
  );
});

// ---------------------------------------------------------------------------
// Store operations

test('converting a text slide to a quiz mints the question it needs', () => {
  begin(doc([text('b01', { bodyMarkdown: 'The scene.' })]));
  useEdit.getState().setSlideKind('b01', 'quiz');

  const block = draft().lesson.blocks[0] as {
    type: string;
    scenario: string;
    questionId: string;
  };
  assert.equal(block.type, 'quick_challenge');
  assert.equal(block.scenario, 'The scene.');
  assert.equal(draft().questions.length, 1);
  assert.deepEqual(draft().lesson.questionIds, [block.questionId]);
});

test('converting a quiz back to text detaches its question', () => {
  begin(doc([text('b01')]));
  useEdit.getState().setSlideKind('b01', 'quiz');
  useEdit.getState().setSlideKind('b01', 'text');

  assert.equal(draft().lesson.blocks[0].type, 'core_rule');
  assert.deepEqual(draft().questions, []);
  assert.deepEqual(draft().lesson.questionIds, []);
});

test('converting a recall card back to text keeps the sentence it hid', () => {
  begin(doc([text('b01')]));
  useEdit.getState().setSlideKind('b01', 'recall');
  useEdit.getState().editBlock('b01', {
    ruleMarkdown: 'Stop before the [[limit line]], always.',
  } as never);
  useEdit.getState().setSlideKind('b01', 'text');

  assert.deepEqual(blockElements(draft().lesson.blocks[0]), [
    { kind: 'paragraph', text: 'Stop before the limit line, always.' },
  ]);
});

test('a checkpoint is refused on a family the player never reads it from', () => {
  begin(doc([text('b01')]));
  useEdit.getState().setBlockType('b01', 'drive_smarter');
  useEdit.getState().setCheckpoint('b01', true);

  assert.equal('checkpointQuestionId' in draft().lesson.blocks[0], false);
  assert.deepEqual(draft().questions, []);
});

test('converting to a check-yourself card keeps the title and seeds a rule', () => {
  begin(doc([text('b01', { title: 'Yellow lines' })]));
  useEdit.getState().setSlideKind('b01', 'recall');

  const block = draft().lesson.blocks[0] as {
    type: string;
    title: string;
    ruleMarkdown: string;
  };
  assert.equal(block.type, 'check_yourself');
  assert.equal(block.title, 'Yellow lines');
  assert.match(block.ruleMarkdown, /\[\[.+\]\]/);
});

test('a checkpoint can be added and removed without leaving a stray question', () => {
  begin(doc([text('b01')]));
  useEdit.getState().setCheckpoint('b01', true);

  const questionId = (
    draft().lesson.blocks[0] as {
      checkpointQuestionId: string;
    }
  ).checkpointQuestionId;
  assert.ok(questionId);
  assert.deepEqual(draft().lesson.questionIds, [questionId]);

  useEdit.getState().setCheckpoint('b01', false);
  assert.deepEqual(draft().lesson.questionIds, []);
  assert.deepEqual(draft().questions, []);
});

test('a custom slide type is stored as styleId, and the family default is not', () => {
  begin(doc([text('b01')]));
  useEdit.getState().setSlideStyle('b01', 'road_hazard');
  assert.equal(blockStyleId(draft().lesson.blocks[0]), 'road_hazard');

  useEdit.getState().setSlideStyle('b01', 'core_rule');
  assert.equal('styleId' in draft().lesson.blocks[0], false);
});

test('switching block family drops a marker the new family has no use for', () => {
  begin(doc([text('b01')]));
  useEdit.getState().setBlockType('b01', 'drive_smarter');
  assert.equal(
    (draft().lesson.blocks[0] as { optional?: boolean }).optional,
    true,
  );

  useEdit.getState().setBlockType('b01', 'exam_trap');
  assert.equal('optional' in draft().lesson.blocks[0], false);
});

test('the last slide cannot be deleted — an empty lesson is not valid', () => {
  begin(doc([text('b01')]));
  useEdit.getState().removeSlide('b01');
  assert.equal(draft().lesson.blocks.length, 1);
});

test('deleting a slide takes its folded image and its checkpoint with it', () => {
  begin(
    doc(
      [
        image('b01', 'a01'),
        text('b02', { checkpointQuestionId: 'q01' }),
        text('b03'),
      ],
      {
        questions: [question('q01')],
        assets: [asset('a01')],
        lesson: { assetIds: ['a01'], questionIds: ['q01'] } as never,
      },
    ),
  );
  useEdit.getState().removeSlide('b02');

  assert.deepEqual(
    draft().lesson.blocks.map(block => block.blockId),
    ['b03'],
  );
  assert.deepEqual(draft().assets, []);
  assert.deepEqual(draft().questions, []);
  assert.deepEqual(draft().lesson.assetIds, []);
});

test('adding an image element registers the asset the lesson must declare', () => {
  begin(doc([text('b01')]));
  useEdit
    .getState()
    .addRowImage(
      'b01',
      0,
      {
        sha256: 'a'.repeat(64),
        mime: 'image/svg+xml',
        sizeBytes: 12,
        width: 2,
        height: 1,
      },
      'Alt',
    );

  const elements = blockElements(draft().lesson.blocks[0]);
  assert.equal(elements[0].kind, 'image');
  const assetId = (elements[0] as { assetId: string }).assetId;
  assert.deepEqual(draft().lesson.assetIds, [assetId]);
  assert.equal(draft().assets.length, 1);
  // The picture was uploaded before the lesson named it, so the reference is
  // the file's own hash — nothing here invents one.
  assert.equal(draft().assets[0].sha256, 'a'.repeat(64));
  assert.equal(draft().assets[0].mime, 'image/svg+xml');
  assert.equal(draft().assets[0].sizeBytes, 12);
});

// ---------------------------------------------------------------------------
// Slide types

test('built-in types are listed even when the course styles none of them', () => {
  const types = slideTypesOf([]);
  assert.ok(types.some(type => type.styleId === 'core_rule' && type.builtIn));
  assert.ok(types.some(type => type.styleId === 'checkpoint'));
  assert.deepEqual(customSlideTypes([]), []);
});

test('an override replaces the built-in label without adding a custom type', () => {
  const types = slideTypesOf([
    { styleId: 'core_rule', label: 'The rule', icon: 'bookmark' },
  ]);
  const row = types.find(type => type.styleId === 'core_rule')!;

  assert.equal(row.label, 'The rule');
  assert.equal(row.builtIn, true);
  assert.deepEqual(
    customSlideTypes([
      { styleId: 'core_rule', label: 'The rule', icon: 'bookmark' },
    ]),
    [],
  );
});

test('a course type of its own is listed as custom', () => {
  const custom = customSlideTypes([
    { styleId: 'road_hazard', label: 'Road hazard', icon: 'check' },
  ]);
  assert.deepEqual(
    custom.map(type => [type.styleId, type.builtIn]),
    [['road_hazard', false]],
  );
});

// ---------------------------------------------------------------------------
// Course-shipped icons
//
// A glyph rides inside the course document, which every update downloads whole,
// so it is minified on the way in. Colour is decided by the artwork itself:
// `currentColor` follows the slide type, anything else keeps its own paint.

test('minifying strips what a drawing tool left behind', () => {
  const raw = `<?xml version="1.0" encoding="UTF-8"?>
    <!-- Generator: Some Editor -->
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://x" viewBox="0 0 16 16"
         inkscape:version="1.1" sodipodi:docname="hazard.svg">
      <title>Hazard</title>
      <desc>A triangle</desc>
      <metadata><rdf/></metadata>
      <path   d="M2 2h12v12H2z"   fill="#B45309"/>
    </svg>`;

  const out = minifySvg(raw);
  assert.ok(!out.includes('<?xml'));
  assert.ok(!out.includes('Generator'));
  assert.ok(!out.includes('<title'));
  assert.ok(!out.includes('<desc'));
  assert.ok(!out.includes('<metadata'));
  assert.ok(!out.includes('inkscape:'));
  assert.ok(!out.includes('sodipodi:'));
  assert.ok(out.includes('d="M2 2h12v12H2z"'));
  assert.ok(out.length < raw.length / 2);
});

test('tinting rewrites paint to currentColor but leaves "none" alone', () => {
  const out = toCurrentColor(
    '<svg><path fill="#B45309" stroke="none" d="M0 0"/><rect style="fill:#fff;stroke:none"/></svg>',
  );

  assert.ok(out.includes('fill="currentColor"'));
  assert.ok(out.includes('stroke="none"'));
  assert.ok(out.includes('fill:currentColor'));
  assert.ok(out.includes('stroke:none'));
  assert.ok(!out.includes('#B45309'));
  assert.equal(followsCurrentColor(out), true);
});

test('a glyph keeping its own colours is left exactly as drawn', () => {
  const own = '<svg><path fill="#B45309"/><path fill="#059669"/></svg>';
  assert.equal(followsCurrentColor(own), false);
  assert.equal(minifySvg(own), own);
});

test('tinting is a per-glyph choice, and flipping it back is lossless', () => {
  const drawn = '<svg><path fill="#B45309" d="M0 0"/></svg>';

  // Held as drawn, a glyph can be tinted and untinted any number of times —
  // no re-upload, and one type's answer says nothing about another's.
  const tinted = tintedIcon(drawn, true);
  assert.equal(followsCurrentColor(tinted), true);
  assert.equal(tintedIcon(drawn, false), drawn);
  assert.equal(
    tintedIcon(drawn, false),
    tintedIcon(tintedIcon(drawn, false), false),
  );

  // A glyph that declares no paint has no colours of its own to keep, so both
  // answers mean the same thing — the editor does not offer it the choice.
  const silhouette = '<svg><path d="M0 0"/></svg>';
  assert.equal(paintsItself(silhouette), false);
  assert.equal(tintedIcon(silhouette, false), tintedIcon(silhouette, true));
});

test('a slide type carries its glyph through the style list and back', () => {
  const glyph =
    '<svg viewBox="0 0 16 16"><path fill="currentColor" d="M0 0"/></svg>';
  const types = slideTypesOf([
    {
      styleId: 'road_hazard',
      label: 'Road hazard',
      icon: 'check',
      iconSvg: glyph,
    },
    { styleId: 'core_rule', label: 'The rule', icon: 'bookmark' },
  ]);

  assert.equal(
    types.find(type => type.styleId === 'road_hazard')?.iconSvg,
    glyph,
  );
  // An override with no glyph of its own does not invent one.
  assert.equal(
    types.find(type => type.styleId === 'core_rule')?.iconSvg,
    undefined,
  );
});

test('the glyph budget counts only what is actually shipped', () => {
  const glyph = '<svg/>';
  assert.equal(cardStylesSvgBytes([]), 0);
  assert.equal(
    cardStylesSvgBytes([
      { styleId: 'a', label: 'A', icon: 'check' },
      { styleId: 'b', label: 'B', icon: 'check', iconSvg: glyph },
      { styleId: 'c', label: 'C', icon: 'check', iconSvg: glyph },
    ]),
    glyph.length * 2,
  );
});
