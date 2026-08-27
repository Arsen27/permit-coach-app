import { INSTALLED_APP_VERSION } from './appVersion';

// Base URL of the dmv-prep content/version server (server/ in this repo,
// deployed on Railway). Public content only — no secrets live here. Leave
// empty until the server is deployed; the app then runs fully on the bundled
// course seed and skips update checks.
export const SERVER_URL = 'https://dmv-server-production.up.railway.app';

// The app's own release version, compared against the server's
// minSupportedAppVersion gate and against the latest release in the store. A
// stale value here makes the server misjudge the app and can block course
// updates outright, so it is read straight out of the binary
// (MARKETING_VERSION / versionName — see appVersion.ts) rather than kept in
// sync by hand. The literal is only the last resort for a runtime where the
// native module cannot answer.
export const APP_VERSION = INSTALLED_APP_VERSION ?? '1.2.0';

// Server-driven course updates are on: the three state courses still ship in
// the bundle (so a fresh install works offline and the seed stays the
// fallback), and the updater downloads a newer version on top of it when the
// content server has one.
export const isServerConfigured = SERVER_URL.length > 0;

// The new-version check hangs off the server URL alone, not off
// isServerConfigured: "there is a newer build in the store" has to keep
// working even if course downloads are switched back off.
export const isReleaseCheckConfigured = SERVER_URL.length > 0;
