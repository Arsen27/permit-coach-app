import { CARD_META, UNKNOWN_META } from '@/components/lesson/cards';
import type { CardMeta } from '@/components/lesson/types';
import type {
  SkeletonAsset,
  SkeletonBlock,
  SkeletonQuestion,
  SkeletonViewLesson,
} from '@admin/api/types';
import type { RenderCard } from '@admin/model/renderCard';

// One skeleton lesson as the card sequence the viewer already knows how to
// draw. The skeleton is authored in the same vocabulary a built lesson uses —
// a card has a type and lines, a recall has a rule with [[gaps]], an image
// names a picture — so it maps onto RenderCard without a second renderer.
//
// Two things a built lesson has and the skeleton does not:
//   - resolved text. Every {{param}} is still a placeholder, which is why the
//     view draws them as chips rather than as words.
//   - artwork bytes. The pictures are files in the app repo; the document only
//     carries the alt text, so a picture is drawn as its placeholder frame with
//     the alt underneath, exactly as a missing asset already is.

export type SkeletonRenderCard = RenderCard & {
  scope: 'universal' | 'state_specific';
  // Set on a state's own block: which state, and the skeleton card its note
  // is anchored after.
  stateCode?: string;
  after?: string;
  rules?: string[];
};

const metaFor = (type: string, stateCode?: string): CardMeta => {
  if (type === 'state_specific') {
    return {
      ...CARD_META.state_specific,
      label: stateCode == null ? 'State specific' : `${stateCode} specific`,
    };
  }
  return (CARD_META as Record<string, CardMeta>)[type] ?? UNKNOWN_META;
};

const imageOf = (
  assetId: string,
  assets: Record<string, SkeletonAsset>,
): RenderCard['image'] => ({
  assetId,
  // No sha256 and no url: the card renderer draws the placeholder frame, which
  // is the honest thing to show for a picture this server does not hold.
  alt: assets[assetId]?.alt ?? assetId,
});

export const skeletonCards = (
  lesson: SkeletonViewLesson,
  assets: Record<string, SkeletonAsset>,
): SkeletonRenderCard[] => {
  const cards: SkeletonRenderCard[] = [];

  // The opening challenge, exactly where the player puts it.
  const challenge = lesson.challenge;
  if (challenge != null) {
    cards.push({
      key: `${lesson.id}-challenge`,
      type: 'quick_challenge',
      kicker: CARD_META.quick_challenge,
      title: 'What would you do?',
      ask: challenge.prompt,
      bodies: [challenge.scenario],
      ...(challenge.image != null && {
        image: imageOf(challenge.image, assets),
      }),
      options: (challenge.choices ?? []).map((text, index) => ({
        id: String(index),
        text,
        correct: index === challenge.correct,
      })),
      scope: lesson.stateCode == null ? 'universal' : 'state_specific',
      ...(lesson.stateCode != null && { stateCode: lesson.stateCode }),
      refs: { blockId: `${lesson.id}-challenge` },
    });
  }

  for (const block of lesson.blocks) {
    cards.push(cardOf(lesson, block, assets));
  }
  return cards;
};

const cardOf = (
  lesson: SkeletonViewLesson,
  block: SkeletonBlock,
  assets: Record<string, SkeletonAsset>,
): SkeletonRenderCard => {
  const common = {
    scope: block.scope,
    ...(block.stateCode != null && { stateCode: block.stateCode }),
    ...(block.after != null && { after: block.after }),
    ...(block.rules != null && { rules: block.rules }),
  };
  const card = block.card;

  if (card.kind === 'image') {
    return {
      ...common,
      key: card.anchor,
      type: 'image',
      kicker: metaFor('image'),
      title: assets[card.assetId]?.alt ?? '',
      bodies: [],
      image: imageOf(card.assetId, assets),
      refs: { blockId: card.anchor, assetId: card.assetId },
    };
  }

  if (card.kind === 'recall') {
    return {
      ...common,
      key: card.anchor,
      type: 'check_yourself',
      kicker: metaFor('check_yourself'),
      title: 'Can you finish the rule?',
      // The [[markers]] stay: they are what the player hides, and the point of
      // reading a recall card is seeing which words they cover.
      bodies: [card.context, card.ruleMarkdown],
      refs: { blockId: card.anchor },
    };
  }

  return {
    ...common,
    key: card.anchor,
    type: card.type,
    kicker: metaFor(card.type, block.stateCode),
    title: card.title,
    bodies: [...card.lines, ...(card.bullets ?? []).map(item => `• ${item}`)],
    ...(block.image != null && { image: imageOf(block.image, assets) }),
    refs: { blockId: card.anchor },
  };
};

// The lesson test, as cards, so the questions a lesson ends on are visible in
// the same read. A numeric question has no prompt choices of its own — it is
// rendered per state from a parameter — so it says which parameter instead.
export const skeletonTestCards = (
  lesson: SkeletonViewLesson,
  assets: Record<string, SkeletonAsset>,
): SkeletonRenderCard[] =>
  lesson.test.map((question, index) =>
    testCard(lesson, question, index, assets),
  );

const testCard = (
  lesson: SkeletonViewLesson,
  question: SkeletonQuestion,
  index: number,
  assets: Record<string, SkeletonAsset>,
): SkeletonRenderCard => ({
  key: `${lesson.id}-q${index + 1}`,
  type: 'lesson_test',
  kicker: {
    label: `Test question ${index + 1}`,
    icon: 'list-check',
    tone: 'accent',
  },
  title: question.prompt ?? '',
  bodies:
    question.numeric == null
      ? [question.explanation]
      : [
          `Rendered per state from {{${question.numeric.param}}} in ${question.numeric.unit}, ` +
            `with distractors at ${question.numeric.offsets.join(', ')}.`,
          question.explanation,
        ],
  ...(question.image != null && { image: imageOf(question.image, assets) }),
  ...(question.choices != null && {
    options: question.choices.map((text, choice) => ({
      id: String(choice),
      text,
      correct: choice === question.correct,
    })),
  }),
  scope: lesson.stateCode == null ? 'universal' : 'state_specific',
  ...(lesson.stateCode != null && { stateCode: lesson.stateCode }),
  refs: { questionId: `${lesson.id}-q${index + 1}` },
});
