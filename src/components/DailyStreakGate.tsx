import React, { useCallback, useEffect, useRef } from 'react';
import { AppState as RNAppState } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { isOnboardingDone } from '@/lib/onboardingFlag';
import { wasStreakModalShown } from '@/lib/streakModalStore';
import { navigationRef } from '@/navigation/rootNavigation';
import { useAppState } from '@/state/AppState';
import { effectiveStreak, localToday } from '@/state/streak';

// Only worth celebrating once a run exists; a single day is just "today".
const MIN_STREAK = 2;

// Headless daily gate for the native Streak sheet: on the first open or
// foreground of each local calendar day, anyone carrying a streak of 2+ days
// gets the sheet presented over the current screen. StreakScreen marks the
// day as shown on mount, which also covers manual opens from the header chip.
const DailyStreakGate: React.FC = () => {
  const { userId } = useAuth();
  const { streak } = useAppState();

  // AppState renders children only after hydration, so the streak here is
  // always the stored one — no need to wait for a load flag.
  const streakRef = useRef(streak);
  streakRef.current = streak;

  // The date already evaluated in this session. Set before any await, so two
  // checks racing (mount + foreground) cannot both present the sheet.
  const checkedFor = useRef<string | null>(null);

  const check = useCallback(async () => {
    const today = localToday();
    if (checkedFor.current === today) {
      return;
    }
    checkedFor.current = today;

    if (effectiveStreak(streakRef.current, today) < MIN_STREAK) {
      return;
    }
    // Onboarding owns the screen on a first run (and on the dev replay).
    if (!(await isOnboardingDone())) {
      checkedFor.current = null;
      return;
    }
    if (await wasStreakModalShown(userId, today)) {
      return;
    }
    if (!navigationRef.isReady()) {
      // Container not mounted yet; let the next foreground retry.
      checkedFor.current = null;
      return;
    }
    navigationRef.navigate('Streak', { source: 'daily' });
  }, [userId]);

  useEffect(() => {
    check();
    const subscription = RNAppState.addEventListener('change', status => {
      if (status === 'active') {
        check();
      }
    });
    return () => subscription.remove();
  }, [check]);

  return null;
};

export default DailyStreakGate;
