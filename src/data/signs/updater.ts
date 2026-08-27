import { isVersionBelow } from '@/data/course/semver';
import { createLogger } from '@/lib/log';
import { APP_VERSION, isServerConfigured } from '@/lib/serverConfig';
import { sha256Hex, utf8ByteLength } from '@/lib/sha256';

import { fetchSignsDocRaw, fetchSignsLatestRaw } from './client';
import { signsStore } from './store';
import { validateSignsDoc, validateSignsLatestResponse } from './wire';

// Checks the content server for a newer signs catalogue and commits it.
// Deliberately quieter than the course updater: the catalogue is one small
// document, nothing about it resets user progress (saved sign ids survive any
// content change), and there is no severity to resolve — so there is no
// prompt, no overlay and no per-user cursor. Verified or nothing: size, then
// sha256 against /v1/signs/latest, then parse, then the structural validator,
// and only a document that passed all four is committed.

export type SignsUpdateStatus =
  | 'up-to-date'
  | 'updated'
  | 'offline'
  | 'failed'
  | 'app-update-required';

export type SignsUpdateResult = { status: SignsUpdateStatus };

const log = createLogger('signs');

let running: Promise<SignsUpdateResult> | null = null;

const run = async (): Promise<SignsUpdateResult> => {
  if (!isServerConfigured) {
    log.info('skipped: SERVER_URL is empty (running on the bundled seed)');
    return { status: 'up-to-date' };
  }
  await signsStore.hydrate();
  const current = signsStore.getSnapshot().deliveryVersion;

  let latestBody: string;
  try {
    latestBody = await fetchSignsLatestRaw();
  } catch {
    return { status: 'offline' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(latestBody);
  } catch {
    log.warn('latest response is not valid JSON');
    return { status: 'failed' };
  }
  const latest = validateSignsLatestResponse(parsed);
  if (!latest.ok) {
    log.warn(`latest response invalid: ${latest.errors[0]}`);
    return { status: 'failed' };
  }

  const { latestVersion, minAppVersion, document } = latest.value;
  if (!isVersionBelow(current, latestVersion)) {
    log.info(`up to date (${current})`);
    return { status: 'up-to-date' };
  }
  // The gate sits before any content fetch: an app below the floor must keep
  // its current catalogue rather than download one it cannot parse.
  if (isVersionBelow(APP_VERSION, minAppVersion)) {
    log.warn(
      `signs ${latestVersion} needs app ${minAppVersion}, running ${APP_VERSION}`,
    );
    return { status: 'app-update-required' };
  }

  log.info(`updating signs ${current} → ${latestVersion}`);
  try {
    const body = await fetchSignsDocRaw(latestVersion);
    const sizeBytes = utf8ByteLength(body);
    if (sizeBytes !== document.sizeBytes) {
      throw new Error(
        `signs doc: size ${sizeBytes} does not match manifest ${document.sizeBytes}`,
      );
    }
    if (sha256Hex(body) !== document.sha256) {
      throw new Error('signs doc: sha256 mismatch against manifest');
    }
    let docParsed: unknown;
    try {
      docParsed = JSON.parse(body);
    } catch {
      throw new Error('signs doc: response body is not valid JSON');
    }
    const doc = validateSignsDoc(docParsed, { deliveryVersion: latestVersion });
    if (!doc.ok) {
      throw new Error(`signs doc failed validation: ${doc.errors[0]}`);
    }
    await signsStore.commit(doc.value, body);
    return { status: 'updated' };
  } catch (error) {
    // Nothing was committed; the unchanged version cursor retries next check.
    log.error('signs update failed', error);
    return { status: 'failed' };
  }
};

export const runSignsUpdate = (): Promise<SignsUpdateResult> => {
  if (running != null) {
    return running;
  }
  running = run().finally(() => {
    running = null;
  });
  return running;
};
