import {
  StreakState,
  bumpStreak,
  effectiveStreak,
  localToday,
  normalizeStreak,
  streakWeek,
} from '@/state/streak';

const state = (
  currentStreak: number,
  lastActiveDate: string | null,
  stats?: Partial<Pick<StreakState, 'longestStreak' | 'daysStudied'>>,
): StreakState => ({
  currentStreak,
  lastActiveDate,
  longestStreak: stats?.longestStreak ?? currentStreak,
  daysStudied: stats?.daysStudied ?? currentStreak,
});

describe('localToday', () => {
  it('uses local date parts, zero-padded', () => {
    expect(localToday(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('bumpStreak', () => {
  it('starts a streak on first activity', () => {
    expect(bumpStreak(state(0, null), '2026-07-31')).toEqual(
      state(1, '2026-07-31', { longestStreak: 1, daysStudied: 1 }),
    );
  });

  it('is a no-op for repeat activity on the same day', () => {
    const streak = state(3, '2026-07-31');
    expect(bumpStreak(streak, '2026-07-31')).toBe(streak);
  });

  it('increments on consecutive days, across month boundaries', () => {
    expect(bumpStreak(state(3, '2026-07-31'), '2026-08-01')).toEqual(
      state(4, '2026-08-01', { longestStreak: 4, daysStudied: 4 }),
    );
  });

  it('resets to 1 after a missed day, keeping the lifetime stats', () => {
    expect(bumpStreak(state(9, '2026-07-29'), '2026-07-31')).toEqual(
      state(1, '2026-07-31', { longestStreak: 9, daysStudied: 10 }),
    );
  });
});

describe('normalizeStreak', () => {
  it('seeds missing lifetime stats from the current run', () => {
    expect(
      normalizeStreak({ currentStreak: 5, lastActiveDate: '2026-07-31' }),
    ).toEqual(state(5, '2026-07-31', { longestStreak: 5, daysStudied: 5 }));
  });

  it('never shrinks stats that are already larger', () => {
    expect(
      normalizeStreak(
        state(2, '2026-07-31', { longestStreak: 8, daysStudied: 20 }),
      ),
    ).toEqual(state(2, '2026-07-31', { longestStreak: 8, daysStudied: 20 }));
  });
});

describe('streakWeek', () => {
  // 2026-08-06 is a Thursday; its week runs Mon 08-03 … Sun 08-09.
  const states = (streak: {
    currentStreak: number;
    lastActiveDate: string | null;
  }) => streakWeek(streak, '2026-08-06').map(day => day.state);

  it('starts on Monday of the current week', () => {
    expect(
      streakWeek({ currentStreak: 0, lastActiveDate: null }, '2026-08-06').map(
        day => day.date,
      ),
    ).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
      '2026-08-09',
    ]);
  });

  it('marks the days the run covers, including today', () => {
    expect(states({ currentStreak: 3, lastActiveDate: '2026-08-06' })).toEqual([
      'missed',
      'done',
      'done',
      'done',
      'future',
      'future',
      'future',
    ]);
  });

  it('leaves today pending when the run ended yesterday', () => {
    expect(states({ currentStreak: 2, lastActiveDate: '2026-08-05' })).toEqual([
      'missed',
      'done',
      'done',
      'today',
      'future',
      'future',
      'future',
    ]);
  });

  it('reaches back into the previous week without marking it', () => {
    expect(states({ currentStreak: 9, lastActiveDate: '2026-08-06' })).toEqual([
      'done',
      'done',
      'done',
      'done',
      'future',
      'future',
      'future',
    ]);
  });

  it('marks nothing with no activity at all', () => {
    expect(states({ currentStreak: 0, lastActiveDate: null })).toEqual([
      'missed',
      'missed',
      'missed',
      'today',
      'future',
      'future',
      'future',
    ]);
  });

  it('handles a Sunday, where the week ends today', () => {
    expect(
      streakWeek(
        { currentStreak: 2, lastActiveDate: '2026-08-09' },
        '2026-08-09',
      ).map(day => day.state),
    ).toEqual([
      'missed',
      'missed',
      'missed',
      'missed',
      'missed',
      'done',
      'done',
    ]);
  });
});

describe('effectiveStreak', () => {
  it('keeps the streak through today and yesterday', () => {
    const streak = { currentStreak: 5, lastActiveDate: '2026-07-30' };
    expect(effectiveStreak(streak, '2026-07-30')).toBe(5);
    expect(effectiveStreak(streak, '2026-07-31')).toBe(5);
  });

  it('drops to 0 once a full day is missed', () => {
    const streak = { currentStreak: 5, lastActiveDate: '2026-07-28' };
    expect(effectiveStreak(streak, '2026-07-31')).toBe(0);
  });

  it('is 0 with no activity at all', () => {
    expect(
      effectiveStreak({ currentStreak: 0, lastActiveDate: null }, '2026-07-31'),
    ).toBe(0);
  });
});
