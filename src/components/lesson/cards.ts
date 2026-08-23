import type {
  CourseLessonV2,
  KnownBlockType,
  LessonBlockV2,
} from '@/data/course/v2/wire';
import {
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

// `stateLabel` is the course's own state ("California", "Florida", …) — the
// jurisdiction-neutral `state_specific` card names it in the kicker.
export const cardMetaFor = (
  block: LessonBlockV2,
  stateLabel: string,
): CardMeta => {
  if (!isKnownBlockType(block.type)) {
    return UNKNOWN_META;
  }
  if (block.type === 'state_specific') {
    return { ...CARD_META.state_specific, label: `${stateLabel} specific` };
  }
  return CARD_META[block.type];
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
