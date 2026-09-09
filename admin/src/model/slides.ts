import { CARD_META } from '@/components/lesson/cards';
import type {
  CardStyleV2,
  CourseChoiceV2,
  CourseQuestionV2,
  KnownBlockType,
  LessonBlockV2,
  LessonDocV2,
  LessonElementV2,
} from '@/data/course/v2/wire';
import {
  KNOWN_BLOCK_TYPES,
  blockAssetIds,
  blockElements,
  blockStyleId,
  checkpointQuestionIdOf,
  elementsToBullets,
  elementsToMarkdown,
  isBulletsElement,
  isCheckYourselfBlock,
  isImageBlock,
  isImageElement,
  isParagraphElement,
  isQuickChallengeBlock,
} from '@/data/course/v2/wire';

// The editor works in slides, not blocks. A slide is one card the learner
// swipes to, and `buildCards()` in the app is the authority on where those
// boundaries fall — an `image` block folds into the block after it, so the two
// together are a single slide that has to move as one. Everything here mirrors
// that rule rather than restating it loosely.

export type SlideKind = 'text' | 'quiz' | 'recall' | 'image' | 'unknown';

export type Slide = {
  // The block that owns the slide — the one an edit is addressed to.
  blockId: string;
  block: LessonBlockV2;
  // Every block the slide occupies, in document order.
  blockIds: string[];
  // Inclusive range of `lesson.blocks` the slide spans.
  from: number;
  to: number;
  kind: SlideKind;
  // The artwork folded in ahead of the card, if any.
  leadingAssetId?: string;
  // The question shown on the slide itself (a quiz), or on the checkpoint card
  // that follows it.
  questionId?: string;
  checkpointQuestionId?: string;
};

export const slideKindOf = (block: LessonBlockV2): SlideKind => {
  if (isImageBlock(block)) {
    return 'image';
  }
  if (isQuickChallengeBlock(block)) {
    return 'quiz';
  }
  if (isCheckYourselfBlock(block)) {
    return 'recall';
  }
  return TEACHING_TYPES.includes(block.type as KnownBlockType)
    ? 'text'
    : 'unknown';
};

// The block families that carry prose. Converting between slide kinds only
// ever lands on one of these, on `check_yourself`, or on `quick_challenge`.
export const TEACHING_TYPES: readonly KnownBlockType[] =
  KNOWN_BLOCK_TYPES.filter(
    type =>
      type !== 'image' &&
      type !== 'quick_challenge' &&
      type !== 'check_yourself',
  );

export const DEFAULT_TEACHING_TYPE: KnownBlockType = 'core_rule';

// Mirrors buildCards(): a run of image blocks folds only its *last* member
// into the block that follows; the earlier ones stand as cards of their own.
export const lessonSlides = (blocks: LessonBlockV2[]): Slide[] => {
  const slides: Slide[] = [];
  blocks.forEach((block, index) => {
    if (isImageBlock(block)) {
      const next = blocks[index + 1];
      if (next != null && !isImageBlock(next)) {
        return;
      }
      slides.push({
        blockId: block.blockId,
        block,
        blockIds: [block.blockId],
        from: index,
        to: index,
        kind: 'image',
        leadingAssetId: block.assetId,
      });
      return;
    }
    const previous = blocks[index - 1];
    const folded = previous != null && isImageBlock(previous);
    slides.push({
      blockId: block.blockId,
      block,
      blockIds: folded ? [previous.blockId, block.blockId] : [block.blockId],
      from: folded ? index - 1 : index,
      to: index,
      kind: slideKindOf(block),
      ...(folded && { leadingAssetId: previous.assetId }),
      ...(isQuickChallengeBlock(block) && { questionId: block.questionId }),
      ...(checkpointQuestionIdOf(block) != null && {
        checkpointQuestionId: checkpointQuestionIdOf(block),
      }),
    });
  });
  return slides;
};

// Slides are contiguous and adjacent, so swapping two of them is a splice of
// two neighbouring ranges. Returns the blocks unchanged when the move would
// fall off either end.
export const withSlideMoved = (
  blocks: LessonBlockV2[],
  blockId: string,
  direction: -1 | 1,
): LessonBlockV2[] => {
  const slides = lessonSlides(blocks);
  const at = slides.findIndex(slide => slide.blockId === blockId);
  const target = at + direction;
  if (at < 0 || target < 0 || target >= slides.length) {
    return blocks;
  }
  const first = slides[Math.min(at, target)];
  const second = slides[Math.max(at, target)];
  return [
    ...blocks.slice(0, first.from),
    ...blocks.slice(second.from, second.to + 1),
    ...blocks.slice(first.from, first.to + 1),
    ...blocks.slice(second.to + 1),
  ];
};

// ---------------------------------------------------------------------------
// Ids

// Draft ids are readable and stable: `<lessonId>-b07`, `<lessonId>-a03`. The
// counter starts past everything already taken so a deleted id is never reused
// within one editing session.
export const nextId = (prefix: string, taken: string[]): string => {
  let index = taken.length + 1;
  while (taken.includes(`${prefix}${String(index).padStart(2, '0')}`)) {
    index += 1;
  }
  return `${prefix}${String(index).padStart(2, '0')}`;
};

export const newUuid = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const nextBlockId = (doc: LessonDocV2): string =>
  nextId(
    `${doc.lesson.lessonId}-b`,
    doc.lesson.blocks.map(block => block.blockId),
  );

export const nextAssetId = (doc: LessonDocV2): string =>
  nextId(
    `${doc.lesson.lessonId}-a`,
    doc.assets.map(asset => asset.assetId),
  );

export const nextQuestionId = (doc: LessonDocV2): string =>
  nextId(
    `${doc.lesson.lessonId}-q`,
    doc.questions.map(question => question.questionId),
  );

// ---------------------------------------------------------------------------
// Body rows
//
// The editor works a line at a time, the way a document editor does: one row is
// one line, and a row can be dragged anywhere. The wire format instead groups
// bullets into a single `bullets` element, so the two shapes are converted at
// the boundary. Splitting on the way in and merging consecutive bullets on the
// way out is what lets a bullet be dragged out of its list, or a paragraph be
// dropped into the middle of one, without the author thinking about elements.

export type BodyRow =
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'image'; assetId: string }
  // An element kind this panel does not know: shown as a placeholder row and
  // put back exactly as it came.
  | { kind: 'other'; element: LessonElementV2 };

export const bodyRows = (elements: LessonElementV2[]): BodyRow[] =>
  elements.flatMap((element): BodyRow[] => {
    if (isParagraphElement(element)) {
      return [{ kind: 'paragraph', text: element.text }];
    }
    if (isBulletsElement(element)) {
      return element.items.map(text => ({ kind: 'bullet' as const, text }));
    }
    if (isImageElement(element)) {
      return [{ kind: 'image', assetId: element.assetId }];
    }
    return [{ kind: 'other', element }];
  });

export const rowsToElements = (rows: BodyRow[]): LessonElementV2[] => {
  const elements: LessonElementV2[] = [];
  for (const row of rows) {
    if (row.kind === 'bullet') {
      const last = elements[elements.length - 1];
      if (last != null && isBulletsElement(last)) {
        last.items.push(row.text);
      } else {
        elements.push({ kind: 'bullets', items: [row.text] });
      }
      continue;
    }
    if (row.kind === 'paragraph') {
      elements.push({ kind: 'paragraph', text: row.text });
      continue;
    }
    if (row.kind === 'image') {
      elements.push({ kind: 'image', assetId: row.assetId });
      continue;
    }
    elements.push(row.element);
  }
  // A body is never nothing: an empty list would fail validation, and an empty
  // editor has no line to type into. Blank rows are dropped on save.
  return elements.length > 0 ? elements : [{ kind: 'paragraph', text: '' }];
};

export const moveRow = (
  rows: BodyRow[],
  from: number,
  to: number,
): BodyRow[] => {
  if (from === to || rows[from] == null) {
    return rows;
  }
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  // Removing the row first shifts everything after it down by one.
  next.splice(from < to ? to - 1 : to, 0, moved);
  return next;
};

// ---------------------------------------------------------------------------
// Writing a body back

export const newChoices = (): CourseChoiceV2[] => [
  { id: 'A', text: 'First answer option', feedback: '' },
  { id: 'B', text: 'Second answer option', feedback: '' },
  { id: 'C', text: 'Third answer option', feedback: '' },
];

export const newQuestion = (
  questionId: string,
  kind: CourseQuestionV2['kind'],
  prompt: string,
): CourseQuestionV2 => ({
  questionId,
  uuid: newUuid(),
  kind,
  prompt,
  choices: newChoices(),
  correctAnswerId: 'A',
  explanation: 'Explain why the correct answer is correct.',
});

// Writes an element list onto a block, keeping the legacy `bodyMarkdown` and
// `bullets` fields a true flattening of it. Older app builds read only those
// two, so they must never fall behind the authored content.
export const withElements = (
  block: LessonBlockV2,
  elements: LessonElementV2[],
): LessonBlockV2 => {
  const next = { ...block } as Record<string, unknown>;
  next.content = elements;
  next.bodyMarkdown = elementsToMarkdown(elements);
  const bullets = elementsToBullets(elements);
  if (bullets.length > 0) {
    next.bullets = bullets;
  } else {
    delete next.bullets;
  }
  return next as LessonBlockV2;
};

// ---------------------------------------------------------------------------
// Slide types

export type SlideType = {
  styleId: string;
  label: string;
  icon: string;
  // A glyph the course ships itself, rather than one built into the app.
  iconSvg?: string;
  tone: string;
  textColor?: string;
  iconColor?: string;
  // Built-in types come from the app's CARD_META and always exist; a course
  // may override one, but it can never be deleted.
  builtIn: boolean;
  // Whether the course carries an override / definition for this id.
  authored: boolean;
};

// `checkpoint` is not a block type — it is the standalone question card — but
// it has a kicker of its own, so it is stylable like any other slide type.
export const BUILT_IN_STYLE_IDS: string[] = [
  ...KNOWN_BLOCK_TYPES,
  'checkpoint',
];

const builtInDefault = (styleId: string) =>
  styleId === 'checkpoint'
    ? CARD_META.core_rule
    : CARD_META[styleId as KnownBlockType];

// The full list the editor shows: every built-in family, with the course's
// overrides folded in, followed by the course's own custom types.
export const slideTypesOf = (cardStyles: CardStyleV2[]): SlideType[] => {
  const authored = new Map(cardStyles.map(style => [style.styleId, style]));
  const rows: SlideType[] = BUILT_IN_STYLE_IDS.map(styleId => {
    const base = builtInDefault(styleId);
    const style = authored.get(styleId);
    return {
      styleId,
      label: style?.label ?? base.label,
      icon: style?.icon ?? base.icon,
      ...(style?.iconSvg != null && { iconSvg: style.iconSvg }),
      tone: style?.tone ?? base.tone,
      ...(style?.textColor != null && { textColor: style.textColor }),
      ...(style?.iconColor != null && { iconColor: style.iconColor }),
      builtIn: true,
      authored: style != null,
    };
  });
  for (const style of cardStyles) {
    if (BUILT_IN_STYLE_IDS.includes(style.styleId)) {
      continue;
    }
    rows.push({
      styleId: style.styleId,
      label: style.label,
      icon: style.icon,
      ...(style.iconSvg != null && { iconSvg: style.iconSvg }),
      tone: style.tone ?? 'muted',
      ...(style.textColor != null && { textColor: style.textColor }),
      ...(style.iconColor != null && { iconColor: style.iconColor }),
      builtIn: false,
      authored: true,
    });
  }
  return rows;
};

// Custom types only — the ones a block has to opt into explicitly, and the
// only ones that can be renamed or removed without touching a built-in family.
export const customSlideTypes = (cardStyles: CardStyleV2[]): SlideType[] =>
  slideTypesOf(cardStyles).filter(type => !type.builtIn);

// ---------------------------------------------------------------------------
// Reconciliation

const inlineQuestionIds = (blocks: LessonBlockV2[]): string[] =>
  blocks.flatMap(block => {
    if (isQuickChallengeBlock(block)) {
      return [block.questionId];
    }
    const checkpointId = checkpointQuestionIdOf(block);
    return checkpointId == null ? [] : [checkpointId];
  });

// Artwork and questions have to stay exactly as referenced as the wire format
// demands: nothing dangling, nothing carried along unused. This runs after any
// edit that could have changed either set. It deliberately only *drops* what no
// block asks for any more — a split lesson's scored test bank is not inline and
// must survive untouched.
export const reconcileReferences = (doc: LessonDocV2): void => {
  const { lesson } = doc;
  const inline = new Set(inlineQuestionIds(lesson.blocks));
  const test = new Set(lesson.testQuestionIds ?? []);
  const keepQuestion = (questionId: string): boolean =>
    inline.has(questionId) || test.has(questionId);

  lesson.questionIds = lesson.questionIds.filter(keepQuestion);
  for (const questionId of inline) {
    if (!lesson.questionIds.includes(questionId)) {
      lesson.questionIds.push(questionId);
    }
  }
  if (lesson.theoryQuestionIds != null) {
    lesson.theoryQuestionIds = lesson.theoryQuestionIds.filter(id =>
      inline.has(id),
    );
    for (const questionId of inline) {
      if (!lesson.theoryQuestionIds.includes(questionId)) {
        lesson.theoryQuestionIds.push(questionId);
      }
    }
  }
  const keptQuestions = new Set(lesson.questionIds);
  doc.questions = doc.questions.filter(question =>
    keptQuestions.has(question.questionId),
  );

  const fromBlocks = lesson.blocks.flatMap(blockAssetIds);
  const fromQuestions = doc.questions
    .map(question => question.assetId)
    .filter((assetId): assetId is string => assetId != null);
  // The authored hero is a reference like any block's: it keeps its asset
  // alive, and it dies itself if its asset is gone.
  const fromHero = lesson.heroAssetId != null ? [lesson.heroAssetId] : [];
  const reachable = new Set([...fromBlocks, ...fromQuestions, ...fromHero]);
  const assetIds = lesson.assetIds.filter(assetId => reachable.has(assetId));
  for (const assetId of fromBlocks) {
    if (!assetIds.includes(assetId)) {
      assetIds.push(assetId);
    }
  }
  for (const assetId of fromHero) {
    if (!assetIds.includes(assetId)) {
      assetIds.push(assetId);
    }
  }
  lesson.assetIds = assetIds;
  if (
    lesson.heroAssetId != null &&
    !doc.assets.some(asset => asset.assetId === lesson.heroAssetId)
  ) {
    delete lesson.heroAssetId;
  }
  const referenced = new Set([...assetIds, ...fromQuestions]);
  doc.assets = doc.assets.filter(asset => referenced.has(asset.assetId));
};
