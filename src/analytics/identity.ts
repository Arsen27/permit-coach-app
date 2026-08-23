import { LOCAL_USER_ID } from '@/sync/types';

import { posthog } from './client';

// Who the events belong to, and what we know about them.
//
// The distinct id is the Supabase user id — the same id the sync engine and
// RevenueCat use, so a learner is one person across all three. That includes
// the anonymous Supabase user every install gets: they are the majority of
// learners, and the pre-signup funnel is exactly what needs measuring. Events
// sent before that session exists (first launch offline) stay on PostHog's own
// anonymous id and are merged in by the first identify.
//
// State lives at module scope, not in a ref: AppStateProvider is keyed on the
// user id, so the component driving this remounts on every account switch.
let identified: string | null = null;

export const syncIdentity = (userId: string): void => {
  if (posthog == null) {
    return;
  }
  // Logged out: drop the identity so the next (anonymous) learner starts as
  // their own person instead of inheriting this one's events.
  if (userId === LOCAL_USER_ID) {
    if (identified != null) {
      posthog.reset();
      identified = null;
    }
    return;
  }
  if (userId === identified) {
    return;
  }
  identified = userId;
  // A provider sign-in can land on a different existing account id. PostHog
  // only merges an anonymous id into an identified one, never two identified
  // ones, so the pre-sign-in events stay on the previous person — the same
  // trade-off the app's own adopt-and-merge makes with local progress.
  posthog.identify(userId);
};

// Account deletion, called once the account is really gone and before the
// server is asked to erase the person: flush what is already queued (so it is
// caught by that erasure rather than arriving after it), then drop the
// identity, so nothing sent from here on can recreate the person.
export const forgetIdentity = async (): Promise<void> => {
  if (posthog == null) {
    return;
  }
  await posthog.flush().catch(() => undefined);
  posthog.reset();
  identified = null;
};

export type LearnerProperties = {
  // PostHog's own display properties: they are what the person list and the
  // replay viewer show instead of a bare uuid. null for anonymous learners —
  // most of them — and for accounts that never picked a name.
  email: string | null;
  name: string | null;
  us_state: string;
  plan: 'free' | 'plus';
  signed_in: boolean;
  streak_current: number;
  streak_longest: number;
  days_studied: number;
  lessons_done: number;
  points: number;
  best_exam: number | null;
  questions_answered: number;
  saved_questions: number;
  mistakes: number;
  saved_signs: number;
  font_id: string;
  accent_id: string;
};

// Person properties, refreshed whenever the underlying state changes. The SDK
// hashes the payload and skips unchanged ones, so calling this on every render
// pass costs nothing.
//
// This carries the account's email and display name, which makes PostHog a
// place personal data lives — it has to be named in the privacy policy, and
// deleting a learner's account should be followed by deleting their PostHog
// person (Data management → Persons, or the API).
export const setLearnerProperties = (properties: LearnerProperties): void => {
  posthog?.setPersonProperties(properties);
};

// Super properties: attached to every event, so any insight can break down by
// state and plan without joining onto the person.
export const registerLearnerContext = (
  properties: Pick<LearnerProperties, 'us_state' | 'plan'>,
): void => {
  posthog?.register(properties);
};
