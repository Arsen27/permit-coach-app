import { Linking, Platform } from 'react-native';

import { isVersionBelow, parseSemver } from '@/data/course/semver';

import { INSTALLED_APP_VERSION } from './appVersion';
import { lastAppUpdateCheckAt, markAppUpdateChecked } from './appUpdateStore';
import { createLogger } from './log';
import { isReleaseCheckConfigured, SERVER_URL } from './serverConfig';

// "There is a newer build in the store" — the whole client half of it.
//
// The server owns both halves of the answer: which version is current, and
// where to send the learner. Hardcoding the store URL here would mean a new
// build every time a listing moves, which is exactly the thing this feature
// exists to avoid.

export const RELEASE_PATH = '/v1/app-release';

const TIMEOUT_MS = 8000;

// "не частіше аніж раз на день": one round trip per calendar day's worth of
// milliseconds, measured from the last answer we actually got.
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const log = createLogger('net');

export type AppRelease = {
  // Latest version live in the store, as a plain "1.2.3".
  latestVersion: string;
  // Deep link to this app's store listing.
  storeUrl: string;
};

// Whatever the server sends is about to be handed to Linking.openURL, so the
// scheme is pinned rather than trusted: a compromised or misconfigured server
// must not be able to open arbitrary URLs (or intents) on the device.
const isStoreUrl = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('https://');

export const parseRelease = (payload: unknown): AppRelease | null => {
  if (typeof payload !== 'object' || payload == null) {
    return null;
  }
  const { latestVersion, storeUrl } = payload as Record<string, unknown>;
  if (typeof latestVersion !== 'string' || parseSemver(latestVersion) == null) {
    return null;
  }
  if (!isStoreUrl(storeUrl)) {
    return null;
  }
  return { latestVersion, storeUrl };
};

const fetchRelease = async (): Promise<AppRelease | null> => {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const path = `${RELEASE_PATH}?platform=${platform}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${SERVER_URL}${path}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      log.warn(`← ${response.status} ${path}`);
      return null;
    }
    const release = parseRelease(await response.json());
    if (release == null) {
      log.warn(`${path} returned an unusable payload`);
    }
    return release;
  } catch (error) {
    log.warn('release check unreachable — retrying on the next foreground');
    log.info('release check error', error);
    return null;
  } finally {
    clearTimeout(timer);
  }
};

let running: Promise<AppRelease | null> | null = null;

// Resolves to the newer release when one exists and the learner should be
// told about it, and to null in every other case — throttled, offline, no
// server configured, unknown local version, or already up to date.
//
// The throttle cursor only moves on an answer we could actually parse, so an
// offline launch retries instead of burning the day.
export const checkForAppUpdate = (
  now: number = Date.now(),
): Promise<AppRelease | null> => {
  if (running != null) {
    return running;
  }
  running = (async (): Promise<AppRelease | null> => {
    if (!isReleaseCheckConfigured) {
      return null;
    }
    const installed = INSTALLED_APP_VERSION;
    if (installed == null) {
      log.warn('release check skipped: installed version is unknown');
      return null;
    }
    const sinceLast = now - (await lastAppUpdateCheckAt());
    if (sinceLast < CHECK_INTERVAL_MS) {
      log.info(
        `release check throttled (${Math.round(
          (CHECK_INTERVAL_MS - sinceLast) / 3600000,
        )}h left)`,
      );
      return null;
    }
    const release = await fetchRelease();
    if (release == null) {
      return null;
    }
    await markAppUpdateChecked(now);
    if (!isVersionBelow(installed, release.latestVersion)) {
      log.info(`app ${installed} is current (store ${release.latestVersion})`);
      return null;
    }
    log.info(`app ${installed} is behind store ${release.latestVersion}`);
    return release;
  })().finally(() => {
    running = null;
  });
  return running;
};

export const openStoreListing = async (url: string): Promise<void> => {
  try {
    await Linking.openURL(url);
  } catch (error) {
    // Nothing to fall back to: the URL is the server's answer and the store
    // app is the only place the update lives. The prompt returns next day.
    log.warn('could not open the store listing', error);
  }
};
