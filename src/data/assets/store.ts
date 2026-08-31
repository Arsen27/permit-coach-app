import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import { base64ToBytes, bytesToBase64 } from '@/lib/base64';
import { fetchBase64 } from '@/lib/fetchBinary';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { createLogger, formatBytes } from '@/lib/log';
import { sha256Hex, sha256HexOfBytes, utf8Bytes } from '@/lib/sha256';

import type { CourseAssetV2 } from '../course/v2/wire';
import { ASSET_EXTENSIONS } from '../course/v2/wire';

// Every picture a lesson or a sign shows. Documents carry a reference — the
// sha256 of the file and its size — and the file itself comes from the content
// server at an address the bootstrap hands over.
//
// Both kinds live on the device, because both have to draw with no network:
// a vector is stored as its markup, a photograph as base64 of its bytes, and
// each is verified against the hash the release named before it is kept. The
// name being the hash is what makes that possible — and what makes a picture
// two lessons share cost one download.
//
// Bodies are read from storage on demand and held in a small cache, so a
// launch does not pull tens of megabytes into memory to draw one card.

const log = createLogger('assets');

const PREFIX = 'dmv-prep/assets/v1';
const bodyKey = (sha256: string) => `${PREFIX}/${sha256}`;
const BASE_URL_KEY = `${PREFIX}/base-url`;

// A slow connection's worth of time for one picture, not a fast one's.
const ASSET_TIMEOUT_MS = 30000;

// What the in-memory cache may hold. A lesson shows a handful of pictures at
// a time; this is generous for that and nowhere near a whole course.
const CACHE_BUDGET = 8 * 1024 * 1024;

// Bodies by sha256: SVG markup for a vector, base64 for a photograph.
const bodies = new Map<string, string>();
let cachedChars = 0;
// Which pictures are on the device. Read once per launch — key names only,
// so it costs nothing and tells every render what is drawable.
let held = new Set<string>();
let baseUrl = '';
const listeners = new Set<() => void>();
// One read per picture, however many cards ask for it at once.
const reads = new Map<string, Promise<string | null>>();

const notify = () => {
  listeners.forEach(listener => listener());
};

const remember = (sha256: string, body: string) => {
  if (bodies.has(sha256)) {
    return;
  }
  bodies.set(sha256, body);
  cachedChars += body.length;
  // Oldest first, which for a lesson read in order is the card behind you.
  while (cachedChars > CACHE_BUDGET && bodies.size > 1) {
    const oldest = bodies.keys().next().value as string;
    cachedChars -= bodies.get(oldest)?.length ?? 0;
    bodies.delete(oldest);
  }
};

export const setAssetsBaseUrl = async (next: string): Promise<void> => {
  if (next.length === 0 || next === baseUrl) {
    return;
  }
  baseUrl = next;
  await AsyncStorage.setItem(BASE_URL_KEY, next).catch(() => undefined);
};

// Reads the pictures a course shows into memory, newest need first, up to the
// cache budget. Called at launch: a card that had to wait for its own read
// showed a placeholder first and the picture a moment later, which is the
// flicker this removes. Chunked, so a course of photographs stops at the
// budget instead of pulling everything off the disk.
const WARM_CHUNK = 32;

export const warmAssets = async (shas: string[]): Promise<void> => {
  const wanted = [...new Set(shas)].filter(sha => !bodies.has(sha));
  for (let index = 0; index < wanted.length; index += WARM_CHUNK) {
    if (cachedChars >= CACHE_BUDGET) {
      log.info(`warm stopped at the cache budget after ${index} pictures`);
      return;
    }
    const chunk = wanted.slice(index, index + WARM_CHUNK);
    const entries = await AsyncStorage.getMany(chunk.map(bodyKey)).catch(
      () => ({} as Record<string, string | null>),
    );
    for (const sha of chunk) {
      const body = entries[bodyKey(sha)];
      if (body != null) {
        remember(sha, body);
        held.add(sha);
      }
    }
  }
  notify();
};

// Restored once per launch: which pictures the device holds, and where new
// ones come from. Without this a restart drew placeholders — the files were
// on the device, and nothing had read them.
export const hydrateAssets = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    held = new Set(
      keys.flatMap(key =>
        key.startsWith(`${PREFIX}/`) && key !== BASE_URL_KEY
          ? [key.slice(`${PREFIX}/`.length)]
          : [],
      ),
    );
    if (baseUrl.length === 0) {
      baseUrl =
        (await AsyncStorage.getItem(BASE_URL_KEY).catch(() => null)) ?? '';
    }
    log.info(`${held.size} pictures on this device`);
    notify();
  } catch (error) {
    log.warn('could not read what pictures are on the device', error);
  }
};

export const assetUrl = (asset: CourseAssetV2): string =>
  `${baseUrl}/${asset.sha256}.${ASSET_EXTENSIONS[asset.mime]}`;

export const isVectorAsset = (asset: { mime: string }): boolean =>
  asset.mime === 'image/svg+xml';

// What a view draws: markup for a vector, a data URI for a photograph. Null
// while the body is still being read off the device, or when it is not there.
export type AssetSource =
  | { kind: 'markup'; markup: string }
  | { kind: 'uri'; uri: string };

const sourceOf = (
  asset: { sha256: string; mime: string },
  body: string,
): AssetSource =>
  isVectorAsset(asset)
    ? { kind: 'markup', markup: body }
    : { kind: 'uri', uri: `data:${asset.mime};base64,${body}` };

// The drawable form of a picture already in memory, or null. Synchronous on
// purpose: a card renders from what is there and never waits.
export const assetSource = (asset: {
  sha256: string;
  mime: string;
}): AssetSource | null => {
  const body = bodies.get(asset.sha256);
  return body == null ? null : sourceOf(asset, body);
};

export const vectorMarkup = (asset: {
  sha256: string;
  mime: string;
}): string | null => {
  const source = assetSource(asset);
  return source?.kind === 'markup' ? source.markup : null;
};

// Reads one picture off the device into the cache. Concurrent callers share
// the one read.
const readBody = (sha256: string): Promise<string | null> => {
  const cached = bodies.get(sha256);
  if (cached != null) {
    return Promise.resolve(cached);
  }
  const existing = reads.get(sha256);
  if (existing != null) {
    return existing;
  }
  const read = AsyncStorage.getItem(bodyKey(sha256))
    .catch(() => null)
    .then(body => {
      if (body != null) {
        remember(sha256, body);
        held.add(sha256);
        notify();
      }
      return body;
    })
    .finally(() => {
      reads.delete(sha256);
    });
  reads.set(sha256, read);
  return read;
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// What to draw for this picture, reading it off the device if it is there and
// not in memory yet. Re-renders the moment it lands.
export const useAssetSource = (
  asset: { sha256: string; mime: string } | null | undefined,
): AssetSource | null => {
  const sha256 = asset?.sha256 ?? '';
  useSyncExternalStore(
    subscribe,
    () => bodies.get(sha256) ?? (held.has(sha256) ? 'pending' : null),
  );
  useEffect(() => {
    if (sha256.length > 0 && !bodies.has(sha256)) {
      void readBody(sha256);
    }
  }, [sha256]);
  return asset == null ? null : assetSource(asset);
};

// Pulls one picture onto the device, verified against the hash the document
// named — the same rule every document goes through, for bytes as well as
// markup, so nothing that disagrees with what the release promised is kept.
const fetchAsset = async (asset: CourseAssetV2): Promise<void> => {
  const url = assetUrl(asset);
  if (isVectorAsset(asset)) {
    const response = await fetchWithRetry(url, {
      timeoutMs: ASSET_TIMEOUT_MS,
    });
    if (!response.ok) {
      throw new Error(
        `asset ${asset.sha256.slice(0, 12)} → ${response.status}`,
      );
    }
    const body = await response.text();
    if (sha256Hex(body) !== asset.sha256) {
      throw new Error(
        `asset ${asset.sha256.slice(0, 12)} does not match its own hash`,
      );
    }
    await store(asset.sha256, body);
    return;
  }
  const { base64, status } = await fetchBase64(url, ASSET_TIMEOUT_MS);
  if (status !== 200) {
    throw new Error(`asset ${asset.sha256.slice(0, 12)} → ${status}`);
  }
  const bytes = base64ToBytes(base64);
  if (bytes == null || sha256HexOfBytes(bytes) !== asset.sha256) {
    throw new Error(
      `asset ${asset.sha256.slice(0, 12)} does not match its own hash`,
    );
  }
  await store(asset.sha256, base64);
};

export type AssetProgress = { fetched: number; total: number };

// Which of these pictures the device does not hold. Cheap enough to ask on
// every check, so a picture lost to an interrupted write or a cleared store
// is noticed and fetched again long before a lesson needs it.
export const missingAssets = async (
  assets: CourseAssetV2[],
): Promise<CourseAssetV2[]> => {
  if (assets.length === 0) {
    return [];
  }
  const keys = new Set(await AsyncStorage.getAllKeys());
  return assets.filter(asset => !keys.has(bodyKey(asset.sha256)));
};

// Makes sure every picture is on the device, downloading the ones that are
// not. A version is only committed once this has succeeded, so a course on
// the device is a course that renders — offline, vectors and photographs
// alike.
export const ensureAssets = async (
  assets: CourseAssetV2[],
  onProgress?: (progress: AssetProgress) => void,
): Promise<void> => {
  const wanted = new Map(assets.map(asset => [asset.sha256, asset]));
  const missing = await missingAssets([...wanted.values()]);
  if (missing.length === 0) {
    return;
  }
  const bytes = missing.reduce((sum, asset) => sum + asset.sizeBytes, 0);
  log.info(`fetching ${missing.length} pictures (${formatBytes(bytes)})`);

  let fetched = 0;
  const total = missing.length;
  onProgress?.({ fetched, total });
  const queue = [...missing];
  const worker = async (): Promise<void> => {
    for (let next = queue.pop(); next != null; next = queue.pop()) {
      await fetchAsset(next);
      fetched += 1;
      onProgress?.({ fetched, total });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  notify();
};

// Forgets every stored picture except the ones named. Runs after a commit, so
// what a replaced version used goes with it.
export const sweepAssets = async (keep: Set<string>): Promise<void> => {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    key => key.startsWith(`${PREFIX}/`) && key !== BASE_URL_KEY,
  );
  const stale = keys.filter(key => !keep.has(key.slice(`${PREFIX}/`.length)));
  if (stale.length > 0) {
    await AsyncStorage.removeMany(stale);
  }
  for (const sha256 of [...bodies.keys()]) {
    if (!keep.has(sha256)) {
      cachedChars -= bodies.get(sha256)?.length ?? 0;
      bodies.delete(sha256);
    }
  }
  held = new Set([...held].filter(sha256 => keep.has(sha256)));
  notify();
};

export const clearAssets = async (): Promise<void> => {
  const keys = (await AsyncStorage.getAllKeys()).filter(key =>
    key.startsWith(`${PREFIX}/`),
  );
  if (keys.length > 0) {
    await AsyncStorage.removeMany(keys);
  }
  bodies.clear();
  cachedChars = 0;
  held = new Set();
  baseUrl = '';
  notify();
};

// Test seam: puts artwork on the device without a server.
export const primeVectorsForTests = async (
  entries: Iterable<[string, string]>,
): Promise<void> => {
  for (const [sha256, markup] of entries) {
    await store(sha256, markup);
  }
};

export const primeRasterForTests = async (
  entries: Iterable<[string, Uint8Array]>,
): Promise<void> => {
  for (const [sha256, bytes] of entries) {
    await store(sha256, bytesToBase64(bytes));
  }
};

// Test seam: what a mounted card's read does, without React.
export const readForTests = (sha256: string): Promise<string | null> =>
  readBody(sha256);

// Test seam.
export const resetAssetsForTests = (): void => {
  bodies.clear();
  cachedChars = 0;
  held = new Set();
  baseUrl = '';
  listeners.clear();
  reads.clear();
};

// Exported for a test that checks the UTF-8 path agrees with the byte path.
export const utf8OfForTests = utf8Bytes;
