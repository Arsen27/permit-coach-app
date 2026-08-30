import { ensureAssets, setAssetsBaseUrl } from '@/data/assets/store';
import { createLogger } from '@/lib/log';
import { SERVER_URL, isServerConfigured } from '@/lib/serverConfig';
import { sha256Hex, utf8ByteLength } from '@/lib/sha256';

import { fetchSignsDocRaw, fetchSignsLatestRaw } from './client';
import { signsArtwork, signsStore } from './store';
import { validateSignsCatalogRef, validateSignsDoc } from './wire';

// Checks the content server for a newer signs catalogue and commits it.
// Deliberately quieter than the course updater: the catalogue is one small
// document, nothing about it resets user progress (saved sign ids survive any
// content change), and it is unversioned — so there is no prompt, no overlay,
// no severity and no ordering. Verified or nothing: size, then sha256, then
// parse, then the structural validator, and only a document that passed all
// four is committed.

export type SignsUpdateStatus = 'up-to-date' | 'updated' | 'offline' | 'failed';

export type SignsUpdateResult = { status: SignsUpdateStatus };

const log = createLogger('signs');

let running: Promise<SignsUpdateResult> | null = null;

const run = async (): Promise<SignsUpdateResult> => {
  if (!isServerConfigured) {
    log.info('skipped: SERVER_URL is empty (running on the bundled seed)');
    return { status: 'up-to-date' };
  }
  await signsStore.hydrate();
  const current = signsStore.getSnapshot().sha256;

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
  const latest = validateSignsCatalogRef(parsed);
  if (!latest.ok) {
    log.warn(`latest response invalid: ${latest.errors[0]}`);
    return { status: 'failed' };
  }

  // Bytes, not versions: any difference — forward or a rollback — is a change
  // worth taking.
  if (latest.value.sha256 === current) {
    log.info(`up to date (${current.slice(0, 12)})`);
    return { status: 'up-to-date' };
  }

  log.info(
    `updating signs ${current.slice(0, 12)} → ${latest.value.sha256.slice(
      0,
      12,
    )}`,
  );
  try {
    const body = await fetchSignsDocRaw();
    const sizeBytes = utf8ByteLength(body);
    if (sizeBytes !== latest.value.sizeBytes) {
      throw new Error(
        `signs doc: size ${sizeBytes} does not match ${latest.value.sizeBytes}`,
      );
    }
    const hash = sha256Hex(body);
    if (hash !== latest.value.sha256) {
      throw new Error('signs doc: sha256 mismatch against the published hash');
    }
    let docParsed: unknown;
    try {
      docParsed = JSON.parse(body);
    } catch {
      throw new Error('signs doc: response body is not valid JSON');
    }
    const doc = validateSignsDoc(docParsed);
    if (!doc.ok) {
      throw new Error(`signs doc failed validation: ${doc.errors[0]}`);
    }
    // The catalogue's pictures come down with it, verified against their own
    // hashes and kept on the device: a sign studied on the train has to draw
    // in a tunnel. The bundled artwork is already there and is skipped.
    await setAssetsBaseUrl(`${SERVER_URL}/v1/assets`);
    await signsStore.commit(doc.value, body, hash);
    try {
      await ensureAssets(signsArtwork());
    } catch (error) {
      // The catalogue itself is committed and correct; a picture that could
      // not be fetched is fetched on the next check.
      log.warn('some sign artwork could not be fetched — next check', error);
    }
    return { status: 'updated' };
  } catch (error) {
    // Nothing was committed; the unchanged hash retries on the next check.
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
