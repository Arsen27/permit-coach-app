import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState as RNAppState } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import CourseUpdateOverlay, {
  CourseUpdatePhase,
} from '@/components/CourseUpdateOverlay';
import { runSignsUpdate } from '@/data/signs/updater';
import { createLogger } from '@/lib/log';
import { isOnboardingDone } from '@/lib/onboardingFlag';
import { useAppState } from '@/state/AppState';

import {
  acceptOffer,
  clearPromptFor,
  syncLazyCourse,
  takePrompt,
} from './lazy';
import type { ReplacePrompt } from './lazy';
import { courseStore } from './store';

const CHECK_THROTTLE_MS = 15 * 60 * 1000;

const log = createLogger('course');

// Asks the server for its verdict on mount and on every foreground
// (throttled), applies whatever it says — a replace lands inside the sync —
// and surfaces the two things that need a human: the yellow-mark notice of a
// non-silent fix, and the offer of a new course.
const SyncManager: React.FC = () => {
  const { userId } = useAuth();
  const { user, lessonScores, changeStateWipingProgress } = useAppState();

  const completedRef = useRef<string[]>([]);
  completedRef.current = Object.entries(lessonScores)
    .filter(([, score]) => score?.completed === true)
    .map(([lessonId]) => lessonId);

  const lastRunAt = useRef(0);
  const warnedAppVersion = useRef(false);
  const [phase, setPhase] = useState<CourseUpdatePhase>('idle');
  const [offer, setOffer] = useState<{
    version: string;
    message: string;
  } | null>(null);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const showPrompt = useCallback(
    (prompt: ReplacePrompt) => {
      const lessons = prompt.lessonIds.length;
      const counted =
        lessons === 1 ? 'one of your lessons' : `${lessons} of your lessons`;
      Alert.alert(
        prompt.kind === 'apology'
          ? 'We corrected the course'
          : 'The rules changed',
        `${
          prompt.message.length > 0
            ? prompt.message
            : prompt.kind === 'apology'
            ? 'We are sorry — some content you already studied had to be corrected.'
            : 'Some rules you already studied have changed.'
        }\n\nThe updated content in ${counted} is marked in yellow — it is worth going through it again.`,
        [{ text: 'OK', onPress: () => void clearPromptFor(userId) }],
      );
    },
    [userId],
  );

  const check = useCallback(async () => {
    const sinceLast = Date.now() - lastRunAt.current;
    if (sinceLast < CHECK_THROTTLE_MS) {
      return;
    }
    if (!(await isOnboardingDone())) {
      return;
    }
    lastRunAt.current = Date.now();

    // The signs ride the same cadence, silently; a signs failure never blocks
    // the course.
    runSignsUpdate().catch(() => undefined);

    try {
      const result = await syncLazyCourse({
        courseId: courseStore.activeCourseId(),
        userId,
        completedLessonIds: completedRef.current,
      });
      if (!alive.current) {
        return;
      }
      if (result.status === 'offline' || result.status === 'failed') {
        // Nothing changed on the device; the next foreground retries.
        lastRunAt.current = 0;
        return;
      }
      if (
        result.status === 'app-update-required' &&
        !warnedAppVersion.current
      ) {
        warnedAppVersion.current = true;
        Alert.alert(
          'Update required',
          'This version of the app is out of date. Please install the latest update to keep your course content correct.',
        );
      }
      // A prompt persisted by this sync — or by one a kill interrupted.
      const prompt = result.prompt ?? (await takePrompt(userId));
      if (prompt != null && alive.current) {
        showPrompt(prompt);
      }
      if (result.offer != null && alive.current) {
        setOffer(result.offer);
        setPhase('offer');
      }
    } catch (error) {
      log.error(
        'sync threw — treating it as a failed run',
        error instanceof Error ? error.message : error,
      );
      lastRunAt.current = 0;
    }
  }, [userId, showPrompt]);

  const onAcceptOffer = useCallback(async () => {
    setPhase('downloading');
    const result = await acceptOffer({
      courseId: courseStore.activeCourseId(),
      userId,
      completedLessonIds: [],
    });
    if (!alive.current) {
      return;
    }
    if (result.status === 'ready') {
      // The deal the learner accepted: the new course starts clean. Wiping is
      // the same move a state switch makes — to the same state.
      changeStateWipingProgress(user.stateCode);
      setOffer(null);
      setPhase('done');
      setTimeout(() => {
        if (alive.current) {
          setPhase('idle');
        }
      }, 1400);
    } else {
      setPhase('failed');
      setTimeout(() => {
        if (alive.current) {
          setPhase('idle');
          setOffer(null);
        }
      }, 2600);
    }
  }, [userId, user.stateCode, changeStateWipingProgress]);

  const onDeclineOffer = useCallback(() => {
    setOffer(null);
    setPhase('idle');
  }, []);

  useEffect(() => {
    check();
    const subscription = RNAppState.addEventListener('change', status => {
      if (status === 'active') {
        check();
      }
    });
    return () => subscription.remove();
  }, [check]);

  return (
    <CourseUpdateOverlay
      phase={phase}
      progress={phase === 'downloading' ? 0.4 : 1}
      offer={
        offer == null ? null : { version: offer.version, notes: offer.message }
      }
      onAcceptOffer={() => void onAcceptOffer()}
      onDeclineOffer={onDeclineOffer}
    />
  );
};

export default SyncManager;
