import type { DiffRun, DiffStats } from './diff';
import { addRuns, diffWords, emptyStats } from './diff';
import type { RenderCard } from './renderCard';
import { cardWordCount } from './renderCard';

// Pairs the two lessons card by card and, when the diff is on, works out the
// word-level runs for every text slot.
//
// Cards are matched by their id, not by their position. Position was wrong the
// moment a slide was inserted or deleted: every card after the change lined up
// against its neighbour, so a lesson that lost one card read as a lesson
// rewritten from that point down, and the one thing that had actually happened
// — a card is gone — was the one thing the comparison did not show.
//
// A card's key is its block id, which is stable across versions by
// construction: an inserted card takes a letter (slide-04a) rather than the
// next number, so nothing after it is renamed. That makes the pairing an
// alignment over ids — the same longest-common-subsequence diffWords runs over
// words — and a deleted card now leaves a gap opposite it with everything
// below still lined up.
//
// Cards without a stable id fall back to what they had before: a competitor
// capture numbers its sections, so the alignment over those ids is the
// alignment over their positions.

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

// One row of the comparison before anything is diffed: which card of the
// selected version stands opposite which card of the reference, and which
// cards stand opposite nothing.
type Pair = { left?: RenderCard; right?: RenderCard };

export const pairCards = (left: RenderCard[], right: RenderCard[]): Pair[] => {
  const m = left.length;
  const n = right.length;

  // lcs[i][j] = how many cards a[i:] and b[j:] still have in common.
  const lcs: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] =
        left[i].key === right[j].key
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const pairs: Pair[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (left[i].key === right[j].key) {
      pairs.push({ left: left[i], right: right[j] });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      // In the selected version and not in the reference: it was added, and
      // the reference shows a gap beside it.
      pairs.push({ left: left[i] });
      i += 1;
    } else {
      pairs.push({ right: right[j] });
      j += 1;
    }
  }
  while (i < m) {
    pairs.push({ left: left[i] });
    i += 1;
  }
  while (j < n) {
    pairs.push({ right: right[j] });
    j += 1;
  }
  return pairs;
};

// `left` is the selected version (the primary pane), `right` the reference.
export const buildCompare = (
  left: RenderCard[],
  right: RenderCard[],
  diffOn: boolean,
): CompareResult => {
  const stats = emptyStats();
  const rows: CompareRow[] = [];

  for (const [index, pair] of pairCards(left, right).entries()) {
    const leftCard = pair.left;
    const rightCard = pair.right;
    const row: CompareRow = {
      // A card that moved is a removal in one place and an addition in
      // another, so the same id can head two rows; the side it appears on
      // keeps them apart.
      key:
        leftCard != null && rightCard != null
          ? leftCard.key
          : leftCard != null
          ? `+${leftCard.key}`
          : rightCard != null
          ? `-${rightCard.key}`
          : `row-${index}`,
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
