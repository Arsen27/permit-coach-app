import React, { useCallback, useEffect, useRef } from 'react';
import { Alert, AppState as RNAppState } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { createLogger } from '@/lib/log';
import { isOnboardingDone } from '@/lib/onboardingFlag';
import { useAppState } from '@/state/AppState';

import { drainPrompt, runCourseUpdate } from './updater';

const CHECK_THROTTLE_MS = 15 * 60 * 1000;

const log = createLogger('course');

// Headless: checks the content server on mount and on every foreground
// (throttled), applies course updates, then surfaces the aggregated prompt
// and the app-version gate. Mounted inside AppState/Auth providers.
const UpdateManager: React.FC = () => {
  const { userId } = useAuth();
  const { lessonScores, topicScores, resetLessons, resetTopics } =
    useAppState();

  const progressRef = useRef({ lessonScores, topicScores });
  progressRef.current = { lessonScores, topicScores };
  const lastRunAt = useRef(0);
  const warnedAppVersion = useRef(false);

  const check = useCallback(async () => {
    const sinceLast = Date.now() - lastRunAt.current;
    if (sinceLast < CHECK_THROTTLE_MS) {
      log.info(
        `check throttled (${Math.round(
          (CHECK_THROTTLE_MS - sinceLast) / 1000,
        )}s left)`,
      );
      return;
    }
    // Onboarding owns the first download; don't race it.
    if (!(await isOnboardingDone())) {
      log.info('check skipped: onboarding owns the first download');
      return;
    }
    lastRunAt.current = Date.now();
    const result = await runCourseUpdate({
      userId,
      getProgress: () => ({
        lessonIds: Object.keys(progressRef.current.lessonScores),
        topicIds: Object.keys(progressRef.current.topicScores),
      }),
      resetLessons,
      resetTopics,
    });
    // The updater already refused to fetch or commit anything when the app is
    // below the server's compatibility floor; here we only tell the user.
    if (result.status === 'app-update-required' && !warnedAppVersion.current) {
      warnedAppVersion.current = true;
      Alert.alert(
        'Update required',
        'This version of the app is out of date. Please install the latest update to keep your course content correct.',
      );
    }
    await drainPrompt(userId, resetLessons, resetTopics);
  }, [userId, resetLessons, resetTopics]);

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

export default UpdateManager;
