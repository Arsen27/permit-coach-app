// Analytics (PostHog). The public surface is deliberately small:
//
//   track('lesson_completed', { ... })   one event, typed against events.ts
//   trackError(error, { ... })           unexpected failures
//   posthog                              the raw client, for feature flags
//
// Nothing here throws or blocks when analytics is unconfigured — see client.ts.
//
// Everything with a heavier dependency is imported from its own module instead
// of through here — '@/analytics/AnalyticsProvider' (reads the auth, purchases
// and state contexts) and '@/analytics/screens' (holds the navigation ref).
// Half the app reports events from inside those, so keeping this entry point
// to the client alone keeps the import graph acyclic and test-friendly.
export { posthog, analyticsEnabled } from './client';
export { requestAccountErasure } from './erasure';
export { forgetIdentity } from './identity';
export { track, trackError } from './events';
export type { AnalyticsEvent, AnalyticsEventMap, QuizMode } from './events';
