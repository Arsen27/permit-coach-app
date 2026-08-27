import { iconXml } from '@/assets/icons';
import type { IconName } from '@/assets/icons';
import type {
  CardStyleV2,
  CourseLessonV2,
  KnownBlockType,
  LessonBlockV2,
} from '@/data/course/v2/wire';
import {
  blockStyleId,
  checkpointQuestionIdOf,
  isImageBlock,
  isKnownBlockType,
  isQuickChallengeBlock,
} from '@/data/course/v2/wire';

import type { CardMeta } from './types';

// Card-type signalling for the deck: the kicker and its colour carry the type,
// never a fully coloured card.

export const CARD_META: Record<KnownBlockType, CardMeta> = {
  quick_challenge: {
    label: 'Quick challenge',
    icon: 'list-check',
    tone: 'accent',
  },
  why_it_matters: {
    label: 'Why it matters',
    icon: 'circle-check',
    tone: 'muted',
  },
  image: { label: 'Visual example', icon: 'file-text', tone: 'muted' },
  core_rule: { label: 'Core rule', icon: 'book-open', tone: 'accent' },
  visual_example: { label: 'Visual example', icon: 'file-text', tone: 'muted' },
  related_rule: { label: 'Related rule', icon: 'book-open', tone: 'muted' },
  california_specific: {
    label: 'California specific',
    icon: 'person',
    tone: 'california',
  },
  // Placeholder label — `cardMetaFor` swaps in the course's own state.
  state_specific: {
    label: 'State specific',
    icon: 'person',
    tone: 'california',
  },
  exam_trap: { label: 'Exam trap', icon: 'triangle-exclamation', tone: 'trap' },
  drive_smarter: {
    label: 'Drive smarter · Optional',
    icon: 'arrow-up-right',
    tone: 'muted',
  },
  remember_this: { label: 'Remember this', icon: 'bookmark', tone: 'accent' },
  check_yourself: { label: 'Check yourself', icon: 'check', tone: 'accent' },
};

export const UNKNOWN_META: CardMeta = {
  label: 'More in this lesson',
  icon: 'book-open',
  tone: 'muted',
};

// The kicker of the standalone checkpoint card. It is not a block, so it has
// no type of its own to hang a style on — `checkpoint` is its reserved id.
export const CHECKPOINT_STYLE_ID = 'checkpoint';

const isIconName = (name: string): name is IconName => name in iconXml;

// `stateLabel` is the course's own state ("California", "Florida", …) — the
// jurisdiction-neutral `state_specific` card names it in the kicker.
const builtInMetaFor = (block: LessonBlockV2, stateLabel: string): CardMeta => {
  if (!isKnownBlockType(block.type)) {
    return UNKNOWN_META;
  }
  if (block.type === 'state_specific') {
    return { ...CARD_META.state_specific, label: `${stateLabel} specific` };
  }
  return CARD_META[block.type];
};

// Folds an authored slide type over a built-in default. Every field the style
// leaves out keeps the default, and an icon name this build does not know is
// ignored rather than blanking the kicker — a course may ship a style authored
// against a newer icon set.
export const applyCardStyle = (
  base: CardMeta,
  style: CardStyleV2,
): CardMeta => ({
  label: style.label.length > 0 ? style.label : base.label,
  icon: isIconName(style.icon) ? style.icon : base.icon,
  tone: style.tone ?? base.tone,
  ...(style.textColor != null && { textColor: style.textColor }),
  ...(style.iconColor != null && { iconColor: style.iconColor }),
});

export const findCardStyle = (
  styleId: string,
  styles?: CardStyleV2[],
): CardStyleV2 | undefined => styles?.find(style => style.styleId === styleId);

export const cardMetaFor = (
  block: LessonBlockV2,
  stateLabel: string,
  styles?: CardStyleV2[],
): CardMeta => {
  const base = builtInMetaFor(block, stateLabel);
  const style = findCardStyle(blockStyleId(block), styles);
  return style == null ? base : applyCardStyle(base, style);
};

// The checkpoint kicker borrows `core_rule`'s look unless the course styles it.
export const checkpointMetaFor = (styles?: CardStyleV2[]): CardMeta => {
  const style = findCardStyle(CHECKPOINT_STYLE_ID, styles);
  return style == null
    ? CARD_META.core_rule
    : applyCardStyle(CARD_META.core_rule, style);
};

export type LessonCard = {
  key: string;
  block: LessonBlockV2;
  // Diagram that belongs to this card: an `image` block is rendered inside the
  // card it introduces, the way the handoff draws teaching cards.
  assetId?: string;
  // Set on cards that carry a question — the opening challenge (inline with
  // its scenario) and the standalone checkpoint cards.
  questionId?: string;
  checkpoint?: boolean;
};

export const buildCards = (lesson: CourseLessonV2): LessonCard[] => {
  const cards: LessonCard[] = [];
  lesson.blocks.forEach((block, index) => {
    const next = lesson.blocks[index + 1];
    if (isImageBlock(block)) {
      // Folded into the following card; a trailing image stands on its own.
      if (next != null && !isImageBlock(next)) {
        return;
      }
      cards.push({ key: block.blockId, block, assetId: block.assetId });
      return;
    }
    const previous = lesson.blocks[index - 1];
    const assetId =
      previous != null && isImageBlock(previous) ? previous.assetId : undefined;

    if (isQuickChallengeBlock(block)) {
      cards.push({
        key: block.blockId,
        block,
        assetId,
        questionId: block.questionId,
      });
      return;
    }
    cards.push({ key: block.blockId, block, assetId });
    const checkpointId = checkpointQuestionIdOf(block);
    if (checkpointId != null) {
      cards.push({
        key: `${block.blockId}-checkpoint`,
        block,
        questionId: checkpointId,
        checkpoint: true,
      });
    }
  });
  return cards;
};

// The asset a card shows: a checkpoint card is deliberately image-free — the
// question owns the card — otherwise the folded image wins over the question's.
export const cardAssetId = (
  card: LessonCard,
  questionAssetId?: string,
): string | undefined =>
  card.assetId ?? (card.checkpoint ? undefined : questionAssetId);
