export type StreakSpan = {
  currentStreak: number;
  // Device-local calendar date (YYYY-MM-DD) of the last learning activity.
  lastActiveDate: string | null;
};

export type StreakState = StreakSpan & {
  // Lifetime stats for the streak sheet. The server only stores the span, so
  // these live locally and merge as monotonic maxima (same posture as
  // bestExam) — see normalizeStreak / mergeStreak.
  longestStreak: number;
  daysStudied: number;
};

// Fills the lifetime stats in for states that predate them (old persisted
// snapshots, the server profile). The current run is the floor for both.
export const normalizeStreak = (
  span: StreakSpan & Partial<StreakState>,
): StreakState => ({
  currentStreak: span.currentStreak,
  lastActiveDate: span.lastActiveDate,
  longestStreak: Math.max(span.longestStreak ?? 0, span.currentStreak),
  daysStudied: Math.max(span.daysStudied ?? 0, span.currentStreak),
});

const pad = (value: number): string => String(value).padStart(2, '0');

// Local date parts, not toISOString() — UTC would shift evenings/mornings
// onto the wrong calendar day and break streaks.
export const localToday = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

// Calendar arithmetic on the local date string; Date normalises overflow, so
// month and year boundaries need no special casing.
export const addDays = (isoDate: string, delta: number): string => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return localToday(new Date(year, month - 1, day + delta));
};

const previousDay = (isoDate: string): string => addDays(isoDate, -1);

export const bumpStreak = (prev: StreakState, today: string): StreakState => {
  if (prev.lastActiveDate === today) {
    return prev;
  }
  const continues = prev.lastActiveDate === previousDay(today);
  const currentStreak = continues ? prev.currentStreak + 1 : 1;
  return {
    currentStreak,
    lastActiveDate: today,
    longestStreak: Math.max(prev.longestStreak, currentStreak),
    daysStudied: prev.daysStudied + 1,
  };
};

export type StreakDayState = 'done' | 'today' | 'missed' | 'future';

// The seven days of the calendar week containing `today`, Monday first. Only
// the streak span is stored, so day-by-day history is derived from it: the
// run ends on lastActiveDate and is currentStreak days long.
export const streakWeek = (
  streak: StreakSpan,
  today: string,
): { date: string; state: StreakDayState }[] => {
  const [year, month, day] = today.split('-').map(Number);
  // getDay() is Sunday-first; the app's day strip starts on Monday.
  const mondayOffset = (new Date(year, month - 1, day).getDay() + 6) % 7;
  const monday = addDays(today, -mondayOffset);

  const last = streak.lastActiveDate;
  const first =
    last == null ? null : addDays(last, -Math.max(0, streak.currentStreak - 1));

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    // ISO date strings compare lexicographically.
    const inStreak =
      last != null && first != null && date >= first && date <= last;
    if (inStreak) {
      return { date, state: 'done' as const };
    }
    if (date === today) {
      return { date, state: 'today' as const };
    }
    return {
      date,
      state: date > today ? ('future' as const) : ('missed' as const),
    };
  });
};

// The streak still counts while today's activity hasn't happened yet; it is
// only lost once a full calendar day has been missed.
export const effectiveStreak = (streak: StreakSpan, today: string): number => {
  if (streak.lastActiveDate == null) {
    return 0;
  }
  if (
    streak.lastActiveDate === today ||
    streak.lastActiveDate === previousDay(today)
  ) {
    return streak.currentStreak;
  }
  return 0;
};
