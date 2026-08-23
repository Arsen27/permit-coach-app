import type { NotificationPermission } from '@/lib/notifications';
import type { QuizParams } from '@/navigation/types';
import type { FontId } from '@/theme';

import { posthog } from './client';

// Every event the app sends, with its property shape. One map instead of
// scattered string literals: a typo is a type error, and this file doubles as
// the tracking plan you read before building an insight in PostHog.
//
// Naming: `object_verb`, snake_case, past tense — PostHog groups events
// alphabetically, so the object first keeps a feature's events together.
// Properties are snake_case too, and never carry anything personal: ids,
// counts and enums only (no question text, no email, no names).

export type QuizMode = QuizParams['mode'];

export type PaywallSource = 'onboarding';

export type AnalyticsEventMap = {
  // ---------------------------------------------------------------- onboarding
  onboarding_started: undefined;
  onboarding_state_selected: { state_code: string };
  onboarding_question_answered: {
    question_id: string;
    question_index: number;
    option_ids: string[];
  };
  onboarding_test_date_selected: {
    // false = "I don't have a date yet".
    scheduled: boolean;
    days_until: number | null;
  };
  // The first-launch course build (the designed loader). Also the app's only
  // hard failure path during onboarding, so the outcome rides along.
  onboarding_course_built: {
    outcome: 'ok' | 'failed';
    // 1 on the first try, 2+ after a retry tap.
    attempt: number;
    duration_ms: number;
  };
  onboarding_reminders_saved: {
    day_count: number;
    hour: number;
    minute: number;
  };
  onboarding_completed: {
    duration_ms: number;
    questions_answered: number;
  };

  // ------------------------------------------------------------- notifications
  notification_permission_answered: {
    result: NotificationPermission;
    source: 'onboarding';
  };

  // ------------------------------------------------------------------- lessons
  lesson_opened: {
    lesson_id: string;
    lesson_number: number;
    card_count: number;
    // Reopened where the learner stopped, rather than started from card 1.
    resumed: boolean;
    already_completed: boolean;
  };
  lesson_checkpoint_answered: {
    lesson_id: string;
    question_id: string;
    correct: boolean;
    // 1-based position among the lesson's questions.
    ordinal: number;
    question_count: number;
  };
  lesson_abandoned: {
    lesson_id: string;
    card_index: number;
    card_count: number;
    questions_answered: number;
    question_count: number;
  };
  // Check-yourself recall cards are unscored; reveal and self-report are
  // separate events so "revealed but never answered" is visible too.
  lesson_recall_revealed: {
    lesson_id: string;
    block_id: string;
  };
  lesson_recall_answered: {
    lesson_id: string;
    block_id: string;
    remembered: boolean;
  };
  lesson_completed: {
    lesson_id: string;
    correct: number;
    question_count: number;
    percent: number;
  };
  lesson_theory_completed: {
    lesson_id: string;
    card_count: number;
  };

  // -------------------------------------------------------------------- quizzes
  quiz_started: {
    mode: QuizMode;
    question_count: number;
    // Module / topic / sign-category id for the modes that have one.
    target_id: string | null;
  };
  quiz_question_answered: {
    mode: QuizMode;
    question_id: string;
    correct: boolean;
    question_index: number;
    question_count: number;
  };
  quiz_abandoned: {
    mode: QuizMode;
    question_index: number;
    question_count: number;
    correct: number;
  };
  quiz_completed: {
    mode: QuizMode;
    correct: number;
    question_count: number;
    percent: number;
    // Mock exam only: the CA pass mark is 83%.
    passed: boolean | null;
    // Mock exam only: the 60-minute clock ran out.
    timed_out: boolean;
  };
  question_bookmark_toggled: { question_id: string; saved: boolean };

  // ---------------------------------------------------------------------- signs
  // Opening a category or a single sign is a navigation, so it arrives as
  // $screen with the id in its properties — only the bookmark is an action.
  sign_bookmark_toggled: { sign_id: string; saved: boolean };

  // --------------------------------------------------------------------- streak
  streak_sheet_opened: {
    streak: number;
    longest_streak: number;
    days_studied: number;
    studied_today: boolean;
    // 'daily' = the once-a-day gate pushed it, 'manual' = the header chip.
    source: 'daily' | 'manual';
  };

  // ----------------------------------------------------------------------- auth
  auth_attempted: { method: 'email' | 'apple' | 'google'; mode: string };
  auth_succeeded: { method: 'email' | 'apple' | 'google'; mode: string };
  auth_failed: {
    method: 'email' | 'apple' | 'google';
    mode: string;
    reason: string;
  };
  auth_signed_out: undefined;
  // Only the failure has an event: a successful deletion erases the person it
  // would have been attached to, so reporting it here would recreate exactly
  // what was just deleted. Successful deletions are counted in the server log
  // by the durable /v1/account/erasure worker instead.
  auth_account_deletion_failed: { reason: string };

  // --------------------------------------------------------------- monetization
  paywall_presented: { source: PaywallSource };
  paywall_closed: {
    source: PaywallSource;
    // RevenueCat's PAYWALL_RESULT: PURCHASED / RESTORED / CANCELLED / ERROR /
    // NOT_PRESENTED (the learner already had Plus).
    result: string;
  };
  purchase_started: { product_id: string | null; source: string };
  purchase_completed: { product_id: string | null; source: string };
  purchase_failed: {
    source: string;
    cancelled: boolean;
    reason: string;
  };
  purchase_restored: { source: string; found: boolean };
  // The RevenueCat entitlement flipping either way, whatever caused it — a
  // purchase here, a renewal, a lapse, or a restore on another device.
  plus_status_changed: { active: boolean };

  // ------------------------------------------------------------------- settings
  // Switching state wipes the old course's progress, so this is the one
  // destructive setting in the app.
  state_changed: { from: string; to: string };
  font_changed: { font_id: FontId };
  external_link_opened: { target: string };
};

export type AnalyticsEvent = keyof AnalyticsEventMap;

// Events with no properties are called with one argument, the rest with two —
// the tuple form is what makes both legal without an `undefined` filler.
type TrackArgs<K extends AnalyticsEvent> =
  AnalyticsEventMap[K] extends undefined
    ? [event: K]
    : [event: K, properties: AnalyticsEventMap[K]];

export const track = <K extends AnalyticsEvent>(
  ...args: TrackArgs<K>
): void => {
  const [event, properties] = args;
  posthog?.capture(event, properties);
};

// Unexpected failures worth seeing in PostHog's error tracking (a course
// bundle that will not parse, a native module that is missing). Errors the app
// already handles as product state — a wrong password, a cancelled purchase —
// belong in the events above, not here.
export const trackError = (
  error: unknown,
  context?: Record<string, string | number | boolean | null>,
): void => {
  posthog?.captureException(error, context);
};
