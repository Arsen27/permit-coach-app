// PostHog project credentials. The project API key is a write-only client
// key, designed to ship in the app bundle — it can send events and read
// feature flags, nothing else. NEVER put a personal API key (phx_…) here.
//
// From the PostHog dashboard: Settings → Project → Project API key.
export const POSTHOG_API_KEY =
  'phc_txirU8JcrELe7pm9buMdWSgqkWFTifFxM6WXAACYXhnR';

// Region-specific ingestion host, shown right under the API key:
//   US cloud  https://us.i.posthog.com
//   EU cloud  https://eu.i.posthog.com
// Self-hosted instances use their own origin.
export const POSTHOG_HOST = 'https://us.i.posthog.com';

// Analytics is off until a key is filled in: every call site goes through the
// same gate, so an unconfigured build behaves exactly like a build without
// the SDK — same as the server/RevenueCat config flags.
export const isAnalyticsConfigured = POSTHOG_API_KEY.length > 0;

// Events are dropped in development by default, so debugging noise never
// lands in the production project.
//
// Keep simulator runs out of production funnels. Temporarily enable this only
// while verifying analytics, or use a separate PostHog development project.
export const ANALYTICS_IN_DEV = false;

// Touch autocapture: every tap, with the component hierarchy it landed in.
// Useful for "what did they actually press" questions, but it multiplies event
// volume (and the bill) by an order of magnitude, and the taps that matter are
// already covered by explicit events. Flip on for a short look, then off.
export const ANALYTICS_CAPTURE_TOUCHES = false;

// Session replay: a screen recording of every session, backed by the
// posthog-react-native-session-replay native package.
//
// OFF for now — on cost. Mobile recordings are billed per session and the free
// tier is only 2,500 a month, so replay would have been the entire PostHog
// bill from roughly 300 active learners upward, while events alone stay free
// to ~3,300. Turning it on is this one flag: the native package stays
// installed and does nothing without it, and the masking config in
// analytics/client.ts is already written.
//
// Two things to settle before flipping it back: the toggle in PostHog →
// Settings → Project → Session replay (the client asking is only half the
// switch), and the privacy policy — a recording of what the learner sees is
// the most sensitive thing this app could collect.
export const ANALYTICS_SESSION_REPLAY = false;

// Fraction of sessions recorded, 0–1, when replay is on. Drop to 0.1–0.2 as
// traffic grows: a fifth of sessions is already more than anyone watches, and
// it cuts the replay bill by roughly the same factor.
export const ANALYTICS_REPLAY_SAMPLE_RATE = 1;
