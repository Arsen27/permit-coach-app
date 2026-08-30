import { Image } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { createLogger, formatBytes } from '@/lib/log';
import { sha256Hex } from '@/lib/sha256';

import type { CourseAssetV2 } from '../course/v2/wire';
import { ASSET_EXTENSIONS } from '../course/v2/wire';

// Every picture a lesson shows. Documents carry a reference — the sha256 of
// the file and its size — and the file itself comes from the content server at
// an address the bootstrap hands over.
//
// Two kinds, held two ways, for one reason: an SVG is small text, so it is
// downloaded, hash-verified and kept beside the documents, which makes it
// available offline and gives the renderer the markup it needs. A photograph
// is large binary that store was never meant to hold, so it goes into the
// platform's own image cache — on disk, keyed by URL, and never stale, because
// the URL is the file's hash and the response says `immutable`.

const log = createLogger('assets');

const PREFIX = 'dmv-prep/assets/v1';
// A picture is at most a few tens of kilobytes; this is a slow connection's
// worth of time for one, not a fast one's.
const ASSET_TIMEOUT_MS = 30000;
const bodyKey = (sha256: string) => `${PREFIX}/${sha256}`;
const BASE_URL_KEY = `${PREFIX}/base-url`;

// The markup of every SVG this process has read, so a re-render is free.
const svgCache = new Map<string, string>();
let baseUrl = '';

export const setAssetsBaseUrl = async (next: string): Promise<void> => {
  if (next.length === 0 || next === baseUrl) {
    return;
  }
  baseUrl = next;
  await AsyncStorage.setItem(BASE_URL_KEY, next).catch(() => undefined);
};

// Restored once per launch: a raster picture renders straight from its URL, so
// the address has to survive a restart even with no network.
export const hydrateAssets = async (): Promise<void> => {
  if (baseUrl.length > 0) {
    return;
  }
  baseUrl = (await AsyncStorage.getItem(BASE_URL_KEY).catch(() => null)) ?? '';
};

export const assetUrl = (asset: CourseAssetV2): string =>
  `${baseUrl}/${asset.sha256}.${ASSET_EXTENSIONS[asset.mime]}`;

export const isVectorAsset = (asset: CourseAssetV2): boolean =>
  asset.mime === 'image/svg+xml';

// The markup of an SVG already on the device, or null. Synchronous on purpose:
// a card renders from what is there and never waits.
export const vectorMarkup = (asset: CourseAssetV2): string | null =>
  svgCache.get(asset.sha256) ?? null;

const readVector = async (sha256: string): Promise<string | null> => {
  const cached = svgCache.get(sha256);
  if (cached != null) {
    return cached;
  }
  const stored = await AsyncStorage.getItem(bodyKey(sha256)).catch(() => null);
  if (stored != null) {
    svgCache.set(sha256, stored);
  }
  return stored;
};

// Pulls one picture onto the device. A vector is verified against the hash the
// document named — the same rule every document goes through — so nothing that
// disagrees with what the release promised is ever stored.
const fetchAsset = async (asset: CourseAssetV2): Promise<void> => {
  const url = assetUrl(asset);
  if (!isVectorAsset(asset)) {
    await Image.prefetch(url);
    return;
  }
  const response = await fetchWithRetry(url, { timeoutMs: ASSET_TIMEOUT_MS });
  if (!response.ok) {
    throw new Error(`asset ${asset.sha256.slice(0, 12)} → ${response.status}`);
  }
  const body = await response.text();
  if (sha256Hex(body) !== asset.sha256) {
    throw new Error(
      `asset ${asset.sha256.slice(0, 12)} does not match its own hash`,
    );
  }
  await AsyncStorage.setItem(bodyKey(asset.sha256), body);
  svgCache.set(asset.sha256, body);
};

// Which of these pictures the device does not hold. Key names only — cheap
// enough to ask on every check, so a picture lost to an interrupted write or
// an evicted cache is noticed and fetched again long before a lesson needs it.
export const missingAssets = async (
  assets: CourseAssetV2[],
): Promise<CourseAssetV2[]> => {
  const vectors = assets.filter(isVectorAsset);
  if (vectors.length === 0) {
    return [];
  }
  const held = new Set(await AsyncStorage.getAllKeys());
  return vectors.filter(asset => !held.has(bodyKey(asset.sha256)));
};

export type AssetProgress = { fetched: number; total: number };

// Makes sure every picture is on the device, downloading the ones that are
// not. A version is only committed once this has succeeded, so a course on the
// device is a course that renders offline.
export const ensureAssets = async (
  assets: CourseAssetV2[],
  onProgress?: (progress: AssetProgress) => void,
): Promise<void> => {
  const wanted = new Map(assets.map(asset => [asset.sha256, asset]));
  const missing: CourseAssetV2[] = [];
  for (const asset of wanted.values()) {
    if (isVectorAsset(asset) && (await readVector(asset.sha256)) != null) {
      continue;
    }
    missing.push(asset);
  }
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
  for (const sha256 of [...svgCache.keys()]) {
    if (!keep.has(sha256)) {
      svgCache.delete(sha256);
    }
  }
};

export const clearAssets = async (): Promise<void> => {
  const keys = (await AsyncStorage.getAllKeys()).filter(key =>
    key.startsWith(`${PREFIX}/`),
  );
  if (keys.length > 0) {
    await AsyncStorage.removeMany(keys);
  }
  svgCache.clear();
  baseUrl = '';
};

// Test seam: puts vector markup on the device without a server, for suites
// that render course artwork.
export const primeVectorsForTests = async (
  entries: Iterable<[string, string]>,
): Promise<void> => {
  for (const [sha256, markup] of entries) {
    svgCache.set(sha256, markup);
    await AsyncStorage.setItem(bodyKey(sha256), markup);
  }
};

// Test seam.
export const resetAssetsForTests = (): void => {
  svgCache.clear();
  baseUrl = '';
};
