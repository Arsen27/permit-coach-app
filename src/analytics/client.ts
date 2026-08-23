import PostHog from 'posthog-react-native';

import {
  ANALYTICS_IN_DEV,
  ANALYTICS_REPLAY_SAMPLE_RATE,
  ANALYTICS_SESSION_REPLAY,
  POSTHOG_API_KEY,
  POSTHOG_HOST,
  isAnalyticsConfigured,
} from '@/lib/analyticsConfig';
import { createLogger } from '@/lib/log';

// The one PostHog instance for the app. Created at module scope (not inside a
// provider) so anything — screens, stores, the sync engine — can report
// without a hook, exactly like the loggers.
//
// null whenever analytics is off: no key filled in, a dev build with
// ANALYTICS_IN_DEV false, or the jest runtime. Every helper below no-ops in
// that case, so call sites never branch on it.

const log = createLogger('analytics');

const isTest = process.env.NODE_ENV === 'test';
const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

export const analyticsEnabled =
  isAnalyticsConfigured && !isTest && (!isDev || ANALYTICS_IN_DEV);

export const posthog: PostHog | null = analyticsEnabled
  ? new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      // The selected course state is already an explicit property. Asking
      // PostHog to derive a physical city/region from the request IP adds
      // unnecessary location data, especially for teenage learners.
      disableGeoip: true,
      // App installed / opened / backgrounded, plus version-change events —
      // this is what retention and "opened the app N days in a row" are built
      // from. On by default since SDK 4.39; set explicitly so it survives an
      // upgrade that flips the default back.
      captureAppLifecycleEvents: true,
      enableSessionReplay: ANALYTICS_SESSION_REPLAY,
      sessionReplayConfig: {
        // Credentials must never reach a frame. This covers every TextInput in
        // the app, and the auth form is additionally wrapped in a mask view.
        maskAllTextInputs: true,
        // Images here are road signs, course diagrams and lesson art — the
        // exact thing a replay is watched for. Nothing user-supplied is ever
        // rendered as an image (the avatar is a letter in a circle), so the
        // default blanket masking would cost the whole point of recording.
        maskAllImages: false,
        // System pickers (photos, contacts) can show anything; the app does
        // not use them today, but the default stays on for whatever lands
        // later.
        maskAllSandboxedViews: true,
        captureLog: true,
        captureNetworkTelemetry: true,
        sampleRate: ANALYTICS_REPLAY_SAMPLE_RATE,
      },
      // Every learner gets a person profile, including the ones who never
      // sign in — they are the majority, and their progress properties are
      // the whole point of the funnel.
      personProfiles: 'always',
    })
  : null;

if (isDev && isAnalyticsConfigured && !ANALYTICS_IN_DEV) {
  log.info('disabled in dev — set ANALYTICS_IN_DEV to watch events');
}
