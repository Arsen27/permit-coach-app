import type { DiffRun, DiffStats } from './diff';
import { addRuns, diffWords, emptyStats } from './diff';
import type { RenderCard } from './renderCard';
import { cardWordCount } from './renderCard';

// Pairs the two lessons card by card and, when the diff is on, works out the
// word-level runs for every text slot. Cards are matched by position, which is
// what the card-sequence format guarantees: a lesson is an ordered deck.

export type CardSlotDiff = {
  title: DiffRun[];
  ask?: DiffRun[];
  bodies: DiffRun[][];
  options: DiffRun[][];
  // Alt text is authored copy, so it is diffed like any other slot.
  imageAlt?: DiffRun[];
};

export type CompareRow = {
  key: string;
  left?: RenderCard;
  right?: RenderCard;
  // Present only while diffing a pair of cards.
  diff?: CardSlotDiff;
  added: boolean;
  removed: boolean;
  // A redrawn illustration changes the lesson without changing a word, so it
  // is reported separately — an illustration-only release must not read as
  // "no changes".
  artworkChanged: boolean;
};

export type CompareResult = {
  rows: CompareRow[];
  stats: DiffStats;
  // Cards whose illustration changed without a word changing.
  artworkChanges: number;
};

// Every illustration a card draws, in order — the one folded in ahead of it
// and each one placed inside the body. Swapping, redrawing, adding or moving
// any of them changes the signature.
const artworkSignature = (card: RenderCard): string =>
  [
    card.image,
    ...(card.inlineImages ?? []).map(image => ({ ...image, url: undefined })),
  ]
    .filter(image => image != null)
    .map(image => `${image!.assetId}\u0000${image!.sha256 ?? image!.url ?? ''}`)
    .join('\u0001');

const artworkDiffers = (left: RenderCard, right: RenderCard): boolean =>
  artworkSignature(left) !== artworkSignature(right);

const slotDiff = (
  before: RenderCard,
  after: RenderCard,
  stats: DiffStats,
): CardSlotDiff => {
  const bodyCount = Math.max(before.bodies.length, after.bodies.length);
  const bodies: DiffRun[][] = [];
  for (let index = 0; index < bodyCount; index++) {
    bodies.push(
      addRuns(
        stats,
        diffWords(before.bodies[index] ?? '', after.bodies[index] ?? ''),
      ),
    );
  }

  const beforeOptions = before.options ?? [];
  const afterOptions = after.options ?? [];
  const optionCount = Math.max(beforeOptions.length, afterOptions.length);
  const options: DiffRun[][] = [];
  for (let index = 0; index < optionCount; index++) {
    options.push(
      addRuns(
        stats,
        diffWords(
          beforeOptions[index]?.text ?? '',
          afterOptions[index]?.text ?? '',
        ),
      ),
    );
  }

  return {
    title: addRuns(stats, diffWords(before.title, after.title)),
    imageAlt:
      before.image != null || after.image != null
        ? addRuns(
            stats,
            diffWords(before.image?.alt ?? '', after.image?.alt ?? ''),
          )
        : undefined,
    ask:
      before.ask != null || after.ask != null
        ? addRuns(stats, diffWords(before.ask ?? '', after.ask ?? ''))
        : undefined,
    bodies,
    options,
  };
};

// `left` is the selected version (the primary pane), `right` the reference.
export const buildCompare = (
  left: RenderCard[],
  right: RenderCard[],
  diffOn: boolean,
): CompareResult => {
  const stats = emptyStats();
  const rows: CompareRow[] = [];
  const count = Math.max(left.length, right.length);

  for (let index = 0; index < count; index++) {
    const leftCard = left[index];
    const rightCard = right[index];
    const row: CompareRow = {
      key: leftCard?.key ?? rightCard?.key ?? `row-${index}`,
      left: leftCard,
      right: rightCard,
      added: false,
      removed: false,
      artworkChanged:
        diffOn &&
        leftCard != null &&
        rightCard != null &&
        artworkDiffers(leftCard, rightCard),
    };

    if (diffOn) {
      if (leftCard != null && rightCard != null) {
        row.diff = slotDiff(rightCard, leftCard, stats);
      } else if (leftCard != null) {
        // Only in the selected version: the whole card is new.
        row.added = true;
        stats.insertions += cardWordCount(leftCard);
      } else if (rightCard != null) {
        row.removed = true;
        stats.deletions += cardWordCount(rightCard);
      }
    }

    rows.push(row);
  }

  return {
    rows,
    stats,
    artworkChanges: rows.filter(row => row.artworkChanged).length,
  };
};
