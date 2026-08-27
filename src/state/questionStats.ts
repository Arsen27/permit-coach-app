// Per-question answer history, the data behind the Practice question-bank map.
// Device-local: the sync schema has no row for it (same posture as the streak
// lifetime stats), so it never rides sync_push and survives merges untouched.

export type QuestionStat = {
  // Times the question has been answered, across every session type.
  seen: number;
  correct: number;
  // Whether the most recent answer was right — a question you just missed is
  // "missed" however good its history is.
  lastCorrect: boolean;
};

export type QuestionStats = Record<string, QuestionStat>;

// The five states the bank map paints, in the handoff's legend order.
export type MasteryState =
  | 'mastered'
  | 'seenOnce'
  | 'shaky'
  | 'missed'
  | 'unseen';

export const recordAnswer = (
  stats: QuestionStats,
  questionId: string,
  correct: boolean,
): QuestionStats => {
  const previous = stats[questionId];
  return {
    ...stats,
    [questionId]: {
      seen: (previous?.seen ?? 0) + 1,
      correct: (previous?.correct ?? 0) + (correct ? 1 : 0),
      lastCorrect: correct,
    },
  };
};

// Right now but wrong before is "shaky", not "mastered": mastery has to be
// earned again after a miss. Right twice with a clean record is mastered;
// a single clean answer is only "seen once".
export const masteryOf = (stat: QuestionStat | undefined): MasteryState => {
  if (stat == null || stat.seen === 0) {
    return 'unseen';
  }
  if (!stat.lastCorrect) {
    return 'missed';
  }
  if (stat.correct < stat.seen) {
    return 'shaky';
  }
  return stat.seen >= 2 ? 'mastered' : 'seenOnce';
};

export type BankSummary = {
  total: number;
  // Questions with any history — the "284" in "284 / 460".
  answered: number;
  states: MasteryState[];
  counts: Record<MasteryState, number>;
};

// Bank map + counters in one pass. `ids` is the full askable universe, so the
// states array lines up 1:1 with it and the caller can render it directly.
export const summarizeBank = (
  ids: string[],
  stats: QuestionStats,
): BankSummary => {
  const counts: Record<MasteryState, number> = {
    mastered: 0,
    seenOnce: 0,
    shaky: 0,
    missed: 0,
    unseen: 0,
  };
  const states = ids.map(id => {
    const state = masteryOf(stats[id]);
    counts[state] += 1;
    return state;
  });
  return {
    total: ids.length,
    answered: ids.length - counts.unseen,
    states,
    counts,
  };
};

// Success rate over a set of questions, as a whole percent — null when none
// of them has ever been answered, which the UI renders as "no standing yet".
// Weighted by attempts rather than by question: every answer the learner gave
// on this material counts once, wherever it was given (topic test, quick mix,
// exam, missed-only), which is what "how am I doing here" means across mixed
// sessions.
export const accuracyOf = (
  ids: string[],
  stats: QuestionStats,
): number | null => {
  let seen = 0;
  let correct = 0;
  ids.forEach(id => {
    const stat = stats[id];
    if (stat == null) {
      return;
    }
    seen += stat.seen;
    correct += stat.correct;
  });
  return seen === 0 ? null : Math.round((correct / seen) * 100);
};

// Adopting a device's progress into an account: keep the richer history per
// question rather than summing, which would double-count shared answers.
export const mergeQuestionStats = (
  base: QuestionStats,
  incoming: QuestionStats,
): QuestionStats => {
  const merged: QuestionStats = { ...incoming };
  Object.entries(base).forEach(([questionId, stat]) => {
    const other = merged[questionId];
    merged[questionId] =
      other == null || stat.seen >= other.seen ? stat : other;
  });
  return merged;
};
