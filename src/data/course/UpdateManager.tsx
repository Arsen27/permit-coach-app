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

import { courseStore } from './store';
import {
  clearDeclinedOffer,
  loadDeclinedOffer,
  saveDeclinedOffer,
} from './offerStore';
import {
  CourseOffer,
  UpdateResult,
  acceptCourseOffer,
  drainPrompt,
  runCourseUpdate,
} from './updater';

const CHECK_THROTTLE_MS = 15 * 60 * 1000;

// A patch is a handful of small documents and can land in a couple of hundred
// milliseconds, which would flash the sheet on and off. Once it is up it holds
// for a beat, and the confirmation gets long enough to actually read.
const MIN_VISIBLE_MS = 900;
const DONE_HOLD_MS = 1400;
const FAILED_HOLD_MS = 2600;

const log = createLogger('course');

const wait = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

// Checks the content server on mount and on every foreground (throttled),
// applies course updates, then surfaces the aggregated prompt and the
// app-version gate. Headless until a download actually starts or an opt-in
// course is on offer — the usual "already current" answer shows the user
// nothing. Mounted inside AppState/Auth providers.
const UpdateManager: React.FC = () => {
  const { userId } = useAuth();
  const { lessonScores, topicScores, resetLessons, resetTopics } =
    useAppState();

  const progressRef = useRef({ lessonScores, topicScores });
  progressRef.current = { lessonScores, topicScores };
  const lastRunAt = useRef(0);
  const warnedAppVersion = useRef(false);

  const [phase, setPhase] = useState<CourseUpdatePhase>('idle');
  const [progress, setProgress] = useState(0);
  const [offer, setOffer] = useState<CourseOffer | null>(null);

  // The sheet is driven across several awaits; an account switch remounts this
  // component mid-flight, and the old run must not keep writing state.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

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

    // The signs catalogue rides the same check cadence but stays silent: one
    // small document, no progress at stake, no sheet. Fire-and-forget — a
    // signs failure must never block the course flow below.
    runSignsUpdate().catch(() => undefined);

    // Stays 0 unless the updater decides there is something to fetch, which is
    // the only thing that puts the sheet on screen.
    let shownAt = 0;

    let result: UpdateResult;
    try {
      result = await runCourseUpdate({
        userId,
        getProgress: () => ({
          lessonIds: Object.keys(progressRef.current.lessonScores),
          topicIds: Object.keys(progressRef.current.topicScores),
        }),
        resetLessons,
        resetTopics,
        onProgress: ({ fetched, total }) => {
          if (!alive.current) {
            return;
          }
          if (shownAt === 0) {
            shownAt = Date.now();
            setPhase('downloading');
          }
          setProgress(total === 0 ? 0 : fetched / total);
        },
      });
    } catch (error) {
      // The updater answers with a status for everything it foresaw. Anything
      // else is a bug — and a bug in the update check must cost a retry, not
      // the app. The course on the device is whatever it was.
      log.error(
        'update check threw — treating it as a failed run',
        error instanceof Error ? error.message : error,
      );
      result = { status: 'failed' };
    }

    if (shownAt > 0) {
      const visible = Date.now() - shownAt;
      if (visible < MIN_VISIBLE_MS) {
        await wait(MIN_VISIBLE_MS - visible);
      }
      // Only a commit earns the confirmation. A download that aborted left the
      // old course in place, and saying "updated" would be a lie — the sheet
      // owns up to the interruption instead of silently vanishing.
      if (alive.current) {
        if (result.status === 'updated') {
          setProgress(1);
          setPhase('done');
          await wait(DONE_HOLD_MS);
        } else {
          // Nothing was committed (the updater aborts the whole content phase
          // on any fetch or verify failure), so the course on device is
          // exactly what it was. Clear the throttle: an interrupted download
          // deserves a retry on the very next launch or foreground, not in
          // fifteen minutes.
          lastRunAt.current = 0;
          setPhase('failed');
          await wait(FAILED_HOLD_MS);
        }
      }
      if (alive.current) {
        setPhase('idle');
        setProgress(0);
      }
    }

    // Both of these take the screen, so they wait for the sheet to be gone —
    // an Alert raised over a Modal is not reliably presentable on iOS.
    //
    // The updater already refused to fetch or commit anything when the app is
    // below the server's compatibility floor; here we only tell the user.
    if (
      (result.status === 'app-update-required' || result.appUpdateRequired) &&
      !warnedAppVersion.current
    ) {
      warnedAppVersion.current = true;
      Alert.alert(
        'Update required',
        'This version of the app is out of date. Please install the latest update to keep your course content correct.',
      );
    }
    await drainPrompt(userId, resetLessons, resetTopics);

    // A fundamentally new course is offered, never imposed — and never nagged:
    // a per-version "not now" stands until a newer opt-in release appears.
    if (result.offer != null && alive.current) {
      const declined = await loadDeclinedOffer(userId);
      const courseId = courseStore.activeCourseId();
      if (
        declined != null &&
        declined.courseId === courseId &&
        declined.version === result.offer.version
      ) {
        log.info(`offer ${result.offer.version} previously declined — quiet`);
      } else if (alive.current) {
        setOffer(result.offer);
        setPhase('offer');
      }
    }
  }, [userId, resetLessons, resetTopics]);

  const acceptOffer = useCallback(async () => {
    setPhase('downloading');
    setProgress(0);
    const startedAt = Date.now();
    const result = await acceptCourseOffer({
      userId,
      getProgress: () => ({
        lessonIds: Object.keys(progressRef.current.lessonScores),
        topicIds: Object.keys(progressRef.current.topicScores),
      }),
      resetLessons,
      resetTopics,
      onProgress: ({ fetched, total }) => {
        if (alive.current) {
          setProgress(total === 0 ? 0 : fetched / total);
        }
      },
    });
    const visible = Date.now() - startedAt;
    if (visible < MIN_VISIBLE_MS) {
      await wait(MIN_VISIBLE_MS - visible);
    }
    if (!alive.current) {
      return;
    }
    if (result.status === 'updated') {
      await clearDeclinedOffer(userId);
      setOffer(null);
      setProgress(1);
      setPhase('done');
      await wait(DONE_HOLD_MS);
    } else {
      // Nothing committed and nothing wiped — the offer stands, and the next
      // check will bring it back.
      setOffer(null);
      setPhase('failed');
      await wait(FAILED_HOLD_MS);
    }
    if (alive.current) {
      setPhase('idle');
      setProgress(0);
    }
  }, [userId, resetLessons, resetTopics]);

  const declineOffer = useCallback(() => {
    const declined = offer;
    setOffer(null);
    setPhase('idle');
    if (declined != null) {
      saveDeclinedOffer(userId, {
        courseId: courseStore.activeCourseId(),
        version: declined.version,
      });
      log.info(`offer ${declined.version} declined`);
    }
  }, [offer, userId]);

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
      progress={progress}
      offer={offer}
      onAcceptOffer={acceptOffer}
      onDeclineOffer={declineOffer}
    />
  );
};

export default UpdateManager;
