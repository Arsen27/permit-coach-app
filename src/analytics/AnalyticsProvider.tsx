import React, { useEffect, useState } from 'react';
import { AppState as RNAppState } from 'react-native';

import { PostHogProvider } from 'posthog-react-native';

import { useAuth } from '@/auth/AuthProvider';
import { useStoredCourse } from '@/data/course/CourseProvider';
import { getContentChannel } from '@/lib/contentChannel';
import { ANALYTICS_CAPTURE_TOUCHES } from '@/lib/analyticsConfig';
import { usePurchases } from '@/purchases/PurchasesProvider';
import { useAppState } from '@/state/AppState';
import { localToday } from '@/state/streak';

import { posthog } from './client';
import {
  registerLearnerContext,
  setLearnerProperties,
  syncIdentity,
} from './identity';

type AnalyticsProviderProps = {
  children: React.ReactNode;
};

// Top-level wrapper. The client itself is created in client.ts (so non-React
// code can report too); the provider only adds the React pieces — the
// usePostHog hook and, when enabled, touch autocapture.
//
// Screen tracking is NOT handled here: @react-navigation/native v7 needs the
// manual path, driven from NavigationContainer's onStateChange in App.tsx.
export const AnalyticsProvider: React.FC<AnalyticsProviderProps> = ({
  children,
}) => {
  if (posthog == null) {
    return <>{children}</>;
  }

  return (
    <PostHogProvider
      client={posthog}
      autocapture={{
        captureScreens: false,
        captureTouches: ANALYTICS_CAPTURE_TOUCHES,
        // Only stable identifiers — the default set includes rendered text,
        // which would put whole question prompts on every touch event.
        propsToCapture: ['testID', 'accessibilityLabel', 'ph-label'],
      }}
    >
      {children}
    </PostHogProvider>
  );
};

// Headless: keeps the PostHog person in step with the account and the learner's
// progress. Sits inside AppState (same slot as IdentityNameSync) because that
// is where all three sources — auth, purchases, persisted state — are readable.
export const AnalyticsIdentity: React.FC = () => {
  const { userId, email, signedIn } = useAuth();
  const { plusActive } = usePurchases();
  // Which content this device is actually running — the whole point of
  // asking "who is still on the old course".
  const course = useStoredCourse();
  const {
    user,
    streak,
    bestExam,
    points,
    lessonsDone,
    questionStats,
    savedQuestionIds,
    mistakeIds,
    savedSignIds,
    fontId,
    accentId,
  } = useAppState();

  useEffect(() => {
    syncIdentity(userId);
  }, [userId]);

  // Last opened: PostHog derives its own last-seen from event timestamps, but
  // that is a query. As a person property it sits in the list beside the
  // course version, which is where the question is actually asked — "who is
  // on 3.2.11 and has not been back since".
  const [openedOn, setOpenedOn] = useState(localToday);
  useEffect(() => {
    const subscription = RNAppState.addEventListener('change', status => {
      if (status === 'active') {
        setOpenedOn(localToday());
      }
    });
    return () => subscription.remove();
  }, []);

  // RevenueCat is the live source of truth for Plus; the synced profiles.plan
  // mirror is the fallback while the entitlement is still unknown.
  const isPlus = plusActive ?? user.plan === 'plus';
  const plan = isPlus ? 'plus' : 'free';

  // Counts, not the collections themselves: recording an answer builds fresh
  // objects in AppState, and depending on references below would post a
  // person-properties update on every answered question.
  const questionsAnswered = Object.keys(questionStats).length;
  const savedQuestions = savedQuestionIds.length;
  const mistakes = mistakeIds.length;
  const savedSigns = savedSignIds.length;

  const courseId = course?.bundle.course.courseId ?? null;
  const courseVersion = course?.deliveryVersion ?? null;
  const channel = getContentChannel();

  useEffect(() => {
    registerLearnerContext({
      us_state: user.stateCode,
      plan,
      course_version: courseVersion,
      content_channel: channel,
    });
    setLearnerProperties({
      email,
      // The profile name — adopted from Apple/Google or typed in later.
      name: user.name.length > 0 ? user.name : null,
      us_state: user.stateCode,
      plan,
      signed_in: signedIn,
      streak_current: streak.currentStreak,
      streak_longest: streak.longestStreak,
      days_studied: streak.daysStudied,
      lessons_done: lessonsDone,
      points,
      best_exam: bestExam,
      questions_answered: questionsAnswered,
      saved_questions: savedQuestions,
      mistakes,
      saved_signs: savedSigns,
      font_id: fontId,
      accent_id: accentId,
      course_id: courseId,
      course_version: courseVersion,
      content_channel: channel,
      last_opened_on: openedOn,
    });
  }, [
    email,
    user.name,
    user.stateCode,
    plan,
    signedIn,
    streak.currentStreak,
    streak.longestStreak,
    streak.daysStudied,
    lessonsDone,
    points,
    bestExam,
    questionsAnswered,
    savedQuestions,
    mistakes,
    savedSigns,
    fontId,
    accentId,
    courseId,
    courseVersion,
    channel,
    openedOn,
  ]);

  return null;
};
