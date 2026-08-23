import {
  QuestionStats,
  masteryOf,
  mergeQuestionStats,
  recordAnswer,
  summarizeBank,
} from '@/state/questionStats';

const answer = (stats: QuestionStats, id: string, ...results: boolean[]) =>
  results.reduce((acc, correct) => recordAnswer(acc, id, correct), stats);

describe('recordAnswer', () => {
  it('counts the first answer', () => {
    expect(recordAnswer({}, 'q1', true)).toEqual({
      q1: { seen: 1, correct: 1, lastCorrect: true },
    });
    expect(recordAnswer({}, 'q1', false)).toEqual({
      q1: { seen: 1, correct: 0, lastCorrect: false },
    });
  });

  it('accumulates and tracks the latest result', () => {
    const stats = answer({}, 'q1', true, false, true);
    expect(stats.q1).toEqual({ seen: 3, correct: 2, lastCorrect: true });
  });

  it('leaves other questions untouched', () => {
    const stats = answer({}, 'q1', true);
    expect(recordAnswer(stats, 'q2', false).q1).toEqual(stats.q1);
  });
});

describe('masteryOf', () => {
  it('reports unseen for a question with no history', () => {
    expect(masteryOf(undefined)).toBe('unseen');
    expect(masteryOf({ seen: 0, correct: 0, lastCorrect: false })).toBe(
      'unseen',
    );
  });

  it('reports seenOnce after a single correct answer', () => {
    expect(masteryOf({ seen: 1, correct: 1, lastCorrect: true })).toBe(
      'seenOnce',
    );
  });

  it('reports mastered only after a clean run of two or more', () => {
    expect(masteryOf({ seen: 2, correct: 2, lastCorrect: true })).toBe(
      'mastered',
    );
  });

  it('reports missed whatever the history, when the last answer was wrong', () => {
    expect(masteryOf({ seen: 9, correct: 8, lastCorrect: false })).toBe(
      'missed',
    );
  });

  it('demotes a recovered question to shaky rather than mastered', () => {
    const stats = answer({}, 'q1', false, true, true);
    expect(masteryOf(stats.q1)).toBe('shaky');
  });
});

describe('summarizeBank', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];

  it('counts an untouched bank as fully unseen', () => {
    const summary = summarizeBank(ids, {});
    expect(summary.total).toBe(5);
    expect(summary.answered).toBe(0);
    expect(summary.counts.unseen).toBe(5);
    expect(summary.states).toEqual(Array(5).fill('unseen'));
  });

  it('maps each id to its state, in bank order', () => {
    let stats: QuestionStats = {};
    stats = answer(stats, 'a', true, true); // mastered
    stats = answer(stats, 'b', true); // seenOnce
    stats = answer(stats, 'c', false, true); // shaky
    stats = answer(stats, 'd', false); // missed

    const summary = summarizeBank(ids, stats);
    expect(summary.states).toEqual([
      'mastered',
      'seenOnce',
      'shaky',
      'missed',
      'unseen',
    ]);
    expect(summary.answered).toBe(4);
    expect(summary.counts).toEqual({
      mastered: 1,
      seenOnce: 1,
      shaky: 1,
      missed: 1,
      unseen: 1,
    });
  });

  it('ignores stats for questions outside the bank', () => {
    const summary = summarizeBank(['a'], answer({}, 'gone', true, true));
    expect(summary.total).toBe(1);
    expect(summary.answered).toBe(0);
  });
});

describe('mergeQuestionStats', () => {
  it('keeps the richer history per question instead of summing', () => {
    const base = answer({}, 'q1', true, true, true);
    const incoming = answer({}, 'q1', false);
    expect(mergeQuestionStats(base, incoming).q1).toEqual({
      seen: 3,
      correct: 3,
      lastCorrect: true,
    });
    expect(mergeQuestionStats(incoming, base).q1).toEqual({
      seen: 3,
      correct: 3,
      lastCorrect: true,
    });
  });

  it('unions questions only one side has seen', () => {
    const merged = mergeQuestionStats(
      answer({}, 'q1', true),
      answer({}, 'q2', false),
    );
    expect(Object.keys(merged).sort()).toEqual(['q1', 'q2']);
  });
});
