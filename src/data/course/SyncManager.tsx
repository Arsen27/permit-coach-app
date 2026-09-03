import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState as RNAppState } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import CourseUpdateOverlay, {
  CourseUpdatePhase,
} from '@/components/CourseUpdateOverlay';
import { runSignsUpdate } from '@/data/signs/updater';
import { createLogger } from '@/lib/log';
import { isOnboardingDone } from '@/lib/onboardingFlag';
import CourseUpdateSheet from '@/components/CourseUpdateSheet';
import { findCourseLesson } from '@/data/course/learn';
import { findState } from '@/data/states';
import { navigationRef } from '@/navigation/rootNavigation';
import { track, trackError } from '@/analytics';
import { noteStep } from '@/analytics/identity';
import { getContentChannel } from '@/lib/contentChannel';
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
  const {
    user,
    lessonScores,
    points,
    lessonsDone,
    bestExam,
    changeStateWipingProgress,
  } = useAppState();

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
  // The fix sheet, held until the learner closes it: it names lessons they
  // finished, so it has to survive the sync that raised it.
  const [prompt, setPrompt] = useState<ReplacePrompt | null>(null);

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
      return;
    }
    if (!(await isOnboardingDone())) {
      return;
    }
    lastRunAt.current = Date.now();
    noteStep('course sync started', {
      version: courseStore.getSnapshot()?.deliveryVersion ?? null,
    });

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
        track('course_sync_failed', {
          reason: result.status,
          version: courseStore.getSnapshot()?.deliveryVersion ?? null,
        });
        lastRunAt.current = 0;
        return;
      }
      if (result.applied != null) {
        track('course_version_changed', {
          from: result.applied.from,
          to: result.applied.to,
          kind: result.applied.kind,
          subtype: result.applied.subtype,
          channel: getContentChannel(),
        });
      }
      if (result.status === 'app-update-required') {
        track('course_sync_failed', {
          reason: 'app_update_required',
          version: courseStore.getSnapshot()?.deliveryVersion ?? null,
        });
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
      const pending = result.prompt ?? (await takePrompt(userId));
      if (pending != null && alive.current) {
        setPrompt(pending);
        track('course_update_sheet_shown', {
          kind: pending.kind,
          version: courseStore.getSnapshot()?.deliveryVersion ?? null,
          lessons: pending.lessonIds.length,
        });
      }
      if (result.offer != null && alive.current) {
        setOffer(result.offer);
        setPhase('offer');
        track('course_update_sheet_shown', {
          kind: 'offer',
          version: result.offer.version,
          lessons: completedRef.current.length,
        });
      }
    } catch (error) {
      log.error(
        'sync threw — treating it as a failed run',
        error instanceof Error ? error.message : error,
      );
      // Not an offline check and not a refusal the store already handled:
      // something got past every guard, which is exactly what error tracking
      // is for.
      trackError(error, {
        where: 'course_sync',
        version: courseStore.getSnapshot()?.deliveryVersion ?? null,
      });
      lastRunAt.current = 0;
    }
  }, [userId]);

  // What the learner did with what we told them — the other half of
  // course_update_sheet_shown, and the only way to know whether a correction
  // ever sent anyone back to the lesson.
  const answered = useCallback(
    (
      kind: 'apology' | 'rules' | 'offer',
      action: 'redo' | 'dismissed' | 'accepted' | 'declined',
      version: string | null,
    ) => {
      track('course_update_sheet_answered', { kind, version, action });
    },
    [],
  );

  const runAcceptedOffer = useCallback(async () => {
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
      track('course_version_changed', {
        from: result.applied?.from ?? null,
        to:
          result.applied?.to ??
          courseStore.getSnapshot()?.deliveryVersion ??
          '',
        kind: 'offer',
        subtype: null,
        channel: getContentChannel(),
      });
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

  // iOS cannot present the download overlay while the offer sheet is still
  // dismissing - doing both in one frame leaves a dead black window until the
  // app is relaunched. So accepting only hides the sheet; the download starts
  // from the sheet's onDismissed (with a timer as the Android/safety net).
  const pendingAccept = useRef(false);
  const startAcceptedOffer = useCallback(() => {
    if (!pendingAccept.current || !alive.current) {
      return;
    }
    pendingAccept.current = false;
    void runAcceptedOffer();
  }, [runAcceptedOffer]);

  const onAcceptOffer = useCallback(() => {
    answered('offer', 'accepted', offer?.version ?? null);
    pendingAccept.current = true;
    setPhase('idle');
    setTimeout(startAcceptedOffer, 700);
  }, [answered, offer, startAcceptedOffer]);

  // The lessons the fix touched, named where naming them helps: one or two
  // titles are worth more than a number, more than that and the number is.
  const markedLessons = useCallback((lessonIds: string[]): string => {
    const titles = lessonIds.flatMap(lessonId => {
      const title = findCourseLesson(lessonId)?.lesson.title;
      return title == null ? [] : [title];
    });
    if (titles.length === 1) {
      return `“${titles[0]}” is marked in yellow`;
    }
    if (titles.length === 2) {
      return `“${titles[0]}” and “${titles[1]}” are marked in yellow`;
    }
    return `${lessonIds.length} finished lessons are marked in yellow`;
  }, []);

  const closePrompt = useCallback(() => {
    if (prompt != null) {
      answered(
        prompt.kind,
        'dismissed',
        courseStore.getSnapshot()?.deliveryVersion ?? null,
      );
    }
    setPrompt(null);
    void clearPromptFor(userId);
  }, [answered, prompt, userId]);

  // Straight to the first lesson that changed: the marks are on the ladder,
  // but the sheet is where the learner is looking.
  const redoMarked = useCallback(
    (lessonIds: string[]) => {
      if (prompt != null) {
        answered(
          prompt.kind,
          'redo',
          courseStore.getSnapshot()?.deliveryVersion ?? null,
        );
      }
      setPrompt(null);
      void clearPromptFor(userId);
      const first = lessonIds.find(
        lessonId => findCourseLesson(lessonId) != null,
      );
      if (first != null && navigationRef.isReady()) {
        navigationRef.navigate('Lesson', { lessonId: first });
      }
    },
    [answered, prompt, userId],
  );

  const onDeclineOffer = useCallback(() => {
    answered('offer', 'declined', offer?.version ?? null);
    setOffer(null);
    setPhase('idle');
  }, [answered, offer]);

  useEffect(() => {
    check();
    const subscription = RNAppState.addEventListener('change', status => {
      if (status === 'active') {
        check();
      }
    });
    return () => subscription.remove();
  }, [check]);

  const finished = prompt?.lessonIds.length ?? 0;
  const lessonWord = finished === 1 ? 'lesson' : 'lessons';
  const stateName = findState(user.stateCode)?.name ?? 'your state';

  return (
    <>
      {prompt != null && (
        <CourseUpdateSheet
          visible
          variant={prompt.kind}
          eyebrow={
            prompt.kind === 'apology'
              ? 'WE GOT SOMETHING WRONG'
              : `${stateName.toUpperCase()} · THE RULES MOVED`
          }
          title={
            prompt.kind === 'apology'
              ? `We fixed ${finished} ${lessonWord} you had finished`
              : `The rules changed in ${finished} ${lessonWord} you finished`
          }
          body={
            prompt.message.length > 0
              ? prompt.message
              : prompt.kind === 'apology'
              ? 'Some of what you already studied was wrong. We have corrected the lessons and the questions — sorry: you trusted us to get this right.'
              : 'Your course already matches the new wording. What you studied before it changed is worth another look.'
          }
          points={[
            prompt.kind === 'apology'
              ? 'Lessons and questions already corrected'
              : 'Lessons and questions already updated',
            markedLessons(prompt.lessonIds),
            'Your points and streak are untouched',
          ]}
          primaryLabel={
            finished === 1 ? 'Redo that lesson' : `Redo the ${finished} lessons`
          }
          onPrimary={() => redoMarked(prompt.lessonIds)}
          secondaryLabel={prompt.kind === 'apology' ? 'Not now' : 'Got it'}
          onSecondary={closePrompt}
        />
      )}

      {/* One sheet at a time: a fix that named finished lessons is read
          before an offer to throw those lessons away. */}
      {offer != null && prompt == null && (
        <CourseUpdateSheet
          visible={phase === 'offer'}
          variant="offer"
          eyebrow={`COURSE VERSION ${offer.version} AVAILABLE`}
          title="A rebuilt course is ready"
          body={
            offer.message.length > 0
              ? offer.message
              : 'This version reorders the course and rewrites its questions. The structure changed too much to carry your progress across.'
          }
          cost={{
            lessonsDone,
            points,
            bestExam,
            note: 'You start again from the first lesson. This cannot be undone, and you cannot go back to your current course later.',
            keeps: 'Your day streak and your saved signs stay with you.',
          }}
          primaryLabel="Update and reset my progress"
          onPrimary={onAcceptOffer}
          armSeconds={5}
          secondaryLabel="Keep my current course"
          onSecondary={onDeclineOffer}
          onDismissed={startAcceptedOffer}
        />
      )}

      <CourseUpdateOverlay
        phase={phase}
        progress={phase === 'downloading' ? 0.4 : 1}
      />
    </>
  );
};

export default SyncManager;
