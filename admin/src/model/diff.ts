// Word-level diff, ported from the design mockup's dw(): an LCS over words
// producing runs of kept / removed / inserted text. Lessons are a few hundred
// words, so the quadratic table is comfortably cheap and gives a much cleaner
// result than a line diff on prose.

export type DiffRun = {
  kind: -1 | 0 | 1; // removed | kept | inserted
  words: string[];
};

const words = (value: string): string[] =>
  String(value ?? '')
    .split(/\s+/)
    .filter(Boolean);

export const diffWords = (before: string, after: string): DiffRun[] => {
  const a = words(before);
  const b = words(after);
  const m = a.length;
  const n = b.length;

  // lcs[i][j] = length of the longest common subsequence of a[i:] and b[j:].
  const lcs: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const runs: DiffRun[] = [];
  const push = (kind: DiffRun['kind'], word: string) => {
    const last = runs[runs.length - 1];
    if (last != null && last.kind === kind) {
      last.words.push(word);
    } else {
      runs.push({ kind, words: [word] });
    }
  };

  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      push(0, a[i]);
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push(-1, a[i]);
      i += 1;
    } else {
      push(1, b[j]);
      j += 1;
    }
  }
  while (i < m) {
    push(-1, a[i]);
    i += 1;
  }
  while (j < n) {
    push(1, b[j]);
    j += 1;
  }

  return runs;
};

export type DiffStats = { insertions: number; deletions: number };

export const emptyStats = (): DiffStats => ({ insertions: 0, deletions: 0 });

export const addRuns = (stats: DiffStats, runs: DiffRun[]): DiffRun[] => {
  for (const run of runs) {
    if (run.kind > 0) {
      stats.insertions += run.words.length;
    }
    if (run.kind < 0) {
      stats.deletions += run.words.length;
    }
  }
  return runs;
};

// A side only shows its own edits: the left (reference) hides insertions, the
// right (selected) hides deletions.
export const runsForSide = (runs: DiffRun[], side: 'before' | 'after') =>
  runs.filter(run => (side === 'before' ? run.kind <= 0 : run.kind >= 0));

export const wordCount = (value: string): number => words(value).length;
