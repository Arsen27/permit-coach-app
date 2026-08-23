// Base URL of the dmv-prep content/version server (server/ in this repo,
// deployed on Railway). Public content only — no secrets live here. Leave
// empty until the server is deployed; the app then runs fully on the bundled
// course seed and skips update checks.
export const SERVER_URL = 'https://dmv-server-production.up.railway.app';

// The app's own release version, compared against the server's
// minSupportedAppVersion gate. Keep in sync with the store release.
export const APP_VERSION = '1.0.0';

// Course downloads are off for this release: all three state courses ship in
// the bundle, so the app runs entirely offline and never talks to the content
// server. Flip to `SERVER_URL.length > 0` to turn server-driven course
// updates back on — the whole updater/manifest pipeline is still in place.
export const isServerConfigured = false;
