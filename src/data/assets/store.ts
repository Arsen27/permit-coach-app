import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { bytesToBase64 } from '@/lib/base64';
import { createLogger, formatBytes } from '@/lib/log';

import { ASSET_EXTENSIONS } from '../course/v2/wire';
import type { CourseAssetV2 } from '../course/v2/wire';

// Every picture a lesson or a sign shows, kept as a real file in the app's
// documents directory, named by the sha256 of its bytes. Documents carry a
// reference — the hash and the size — and the file itself comes from the
// content server at an address the bootstrap hands over.
//
// A vector is text: its markup is read into memory to be parsed and drawn.
// A photograph never crosses the bridge at all — its source is a file://
// URI, and the platform's own image pipeline does the decoding and caching.
// That is the point of the file store: base64 in AsyncStorage was fine for
// SVG and would have been a bridge-choking slow road for PNG.
//
// Downloads are verified natively (the file is hashed on disk) against the
// hash the release named, so nothing that disagrees with what was promised
// is ever kept — and the name being the hash is what makes a picture two
// lessons share cost one download.

const log = createLogger('assets');

// The AsyncStorage generation of this store. Old installs are migrated off
// it on first launch; the base-url key stays, it is configuration.
const PREFIX = 'dmv-prep/assets/v1';
const BASE_URL_KEY = `${PREFIX}/base-url`;

const DIR = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/content-assets`;

// A slow connection's worth of time for one picture, not a fast one's.
const ASSET_TIMEOUT_MS = 30000;

// What the in-memory cache may hold — vector markup only; photographs live
// as files and cost no memory here. A lesson shows a handful of diagrams at
// a time; this is generous for that and nowhere near a whole course.
const CACHE_BUDGET = 8 * 1024 * 1024;

// What the store needs to know about a picture: enough to name the file,
// fetch it, and verify it. Course assets and sign references both satisfy it.
export type AssetRef = { sha256: string; mime: string; sizeBytes: number };

export const isVectorAsset = (asset: { mime: string }): boolean =>
  asset.mime === 'image/svg+xml';

const extOf = (mime: string): string =>
  ASSET_EXTENSIONS[mime as CourseAssetV2['mime']] ?? 'bin';

const pathOf = (sha256: string, ext: string): string =>
  `${DIR}/${sha256}.${ext}`;

// Vector markup by sha256, budgeted.
const bodies = new Map<string, string>();
let cachedChars = 0;
// Which pictures are on the device, and each file's extension — learned
// once per launch from the directory listing, kept true by every write.
let held = new Map<string, string>();
let baseUrl = '';
// Whether the launch warm-up has finished. The app shell waits for this the
// same way it waits for the course itself.
let warmedOnce = false;
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

// Moves the AsyncStorage generation onto the file system, once. Vectors are
// recognisable by their markup; a photograph's base64 betrays its format in
// the first bytes. Anything unrecognisable is dropped and simply
// re-downloaded — the name is the hash, the server still has the bytes.
const migrateLegacy = async (): Promise<void> => {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    key => key.startsWith(`${PREFIX}/`) && key !== BASE_URL_KEY,
  );
  if (keys.length === 0) {
    return;
  }
  const entries = await AsyncStorage.getMany(keys);
  let moved = 0;
  for (const key of keys) {
    const body = entries[key];
    const sha256 = key.slice(`${PREFIX}/`.length);
    if (body == null) {
      continue;
    }
    const kind = body.trimStart().startsWith('<')
      ? { ext: 'svg', encoding: 'utf8' as const }
      : body.startsWith('iVBOR')
      ? { ext: 'png', encoding: 'base64' as const }
      : body.startsWith('/9j/')
      ? { ext: 'jpg', encoding: 'base64' as const }
      : null;
    if (kind == null) {
      continue;
    }
    await ReactNativeBlobUtil.fs.writeFile(
      pathOf(sha256, kind.ext),
      body,
      kind.encoding,
    );
    moved += 1;
  }
  await AsyncStorage.removeMany(keys);
  log.info(`${moved} pictures moved to the file store`);
};

// Restored once per launch: which pictures the device holds, and where new
// ones come from. Runs before anything else touches the store — the other
// entry points wait on it, so a caller racing the launch is safe.
let hydration: Promise<void> | null = null;

const hydrate = async (): Promise<void> => {
  try {
    await ReactNativeBlobUtil.fs.mkdir(DIR).catch(() => undefined);
    await migrateLegacy().catch(error =>
      log.warn('could not migrate the old picture store', error),
    );
    const names = await ReactNativeBlobUtil.fs.ls(DIR);
    held = new Map(
      names.flatMap(name => {
        const dot = name.lastIndexOf('.');
        return dot > 0 && !name.endsWith('.part')
          ? [[name.slice(0, dot), name.slice(dot + 1)]]
          : [];
      }),
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

const whenHydrated = (): Promise<void> => {
  if (hydration == null) {
    hydration = hydrate();
  }
  return hydration;
};

export const hydrateAssets = (): Promise<void> => whenHydrated();

// Declares the warm-up finished, success or not: an app that never mounts
// because a storage read failed would be a far worse bug than a placeholder.
export const markArtworkReady = (): void => {
  if (!warmedOnce) {
    warmedOnce = true;
    notify();
  }
};

export const artworkReady = (): boolean => warmedOnce;

// Whether this picture's drawable form is in memory (for a photograph, the
// file URI needs no memory — being on the device is enough).
export const assetInMemory = (sha256: string): boolean => bodies.has(sha256);

// Whether the device holds this vector but has not read it into memory yet —
// "not yet", as opposed to "not there".
export const assetPending = (asset: {
  sha256: string;
  mime: string;
}): boolean =>
  isVectorAsset(asset) && !bodies.has(asset.sha256) && held.has(asset.sha256);

export const assetUrl = (asset: AssetRef): string =>
  `${baseUrl}/${asset.sha256}.${extOf(asset.mime)}`;

// What a view draws: markup for a vector, a file URI for a photograph. Null
// while a vector is still being read off the device, or when the picture is
// not there.
export type AssetSource =
  | { kind: 'markup'; markup: string }
  | { kind: 'uri'; uri: string };

export const assetSource = (asset: {
  sha256: string;
  mime: string;
}): AssetSource | null => {
  if (isVectorAsset(asset)) {
    const body = bodies.get(asset.sha256);
    return body == null ? null : { kind: 'markup', markup: body };
  }
  const ext = held.get(asset.sha256);
  return ext == null
    ? null
    : { kind: 'uri', uri: `file://${pathOf(asset.sha256, ext)}` };
};

export const vectorMarkup = (asset: {
  sha256: string;
  mime: string;
}): string | null => {
  const source = assetSource(asset);
  return source?.kind === 'markup' ? source.markup : null;
};

export const useArtworkReady = (): boolean =>
  useSyncExternalStore(subscribe, artworkReady);

// Reads one vector off the device into the cache. Concurrent callers share
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
  const read = whenHydrated()
    .then(() => {
      const ext = held.get(sha256);
      if (ext == null) {
        return null;
      }
      return ReactNativeBlobUtil.fs.readFile(pathOf(sha256, ext), 'utf8');
    })
    .catch(() => null)
    .then(body => {
      if (typeof body === 'string') {
        remember(sha256, body);
        notify();
        return body;
      }
      return null;
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

// What to draw for this picture, reading it off the device if it is there
// and not in memory yet. Re-renders the moment it lands.
export const useAssetSource = (
  asset: { sha256: string; mime: string } | null | undefined,
): { source: AssetSource | null; pending: boolean } => {
  const sha256 = asset?.sha256 ?? '';
  const vector = asset != null && isVectorAsset(asset);
  useSyncExternalStore(subscribe, () =>
    vector
      ? bodies.get(sha256) ?? (held.has(sha256) ? 'pending' : null)
      : held.get(sha256) ?? null,
  );
  useEffect(() => {
    if (vector && sha256.length > 0 && !bodies.has(sha256)) {
      void readBody(sha256);
    }
  }, [vector, sha256]);
  return {
    source: asset == null ? null : assetSource(asset),
    pending: asset != null && assetPending(asset),
  };
};

// Reads the vectors among these pictures into memory in one burst — a card
// that had to wait for its own read showed a skeleton first and the diagram
// a moment later. Photographs need no warming: their file URI is free.
export const warmAssets = async (
  refs: { sha256: string; mime: string }[],
): Promise<void> => {
  await whenHydrated();
  const wanted = [
    ...new Map(
      refs
        .filter(
          ref =>
            isVectorAsset(ref) &&
            !bodies.has(ref.sha256) &&
            held.has(ref.sha256),
        )
        .map(ref => [ref.sha256, ref] as const),
    ).values(),
  ];
  if (wanted.length === 0) {
    return;
  }
  const elapsed = log.time();
  const read = (
    await Promise.all(wanted.map(ref => readBody(ref.sha256)))
  ).filter(body => body != null).length;
  log.info(`${read} pictures ready (${elapsed()}ms)`);
};

// One picture onto the device: downloaded to a scratch name, hashed on disk
// natively, and only then given its real name — so a torn download can never
// be mistaken for the picture, and the JS thread never hashes a photograph.
const fetchAsset = async (asset: AssetRef): Promise<void> => {
  const ext = extOf(asset.mime);
  const part = `${pathOf(asset.sha256, ext)}.part`;
  const url = assetUrl(asset);
  let response: Awaited<
    ReturnType<ReturnType<typeof ReactNativeBlobUtil.config>['fetch']>
  >;
  try {
    response = await ReactNativeBlobUtil.config({
      path: part,
      timeout: ASSET_TIMEOUT_MS,
    }).fetch('GET', url);
  } catch (error) {
    await ReactNativeBlobUtil.fs.unlink(part).catch(() => undefined);
    throw error;
  }
  const status = response.info().status;
  if (status !== 200) {
    await ReactNativeBlobUtil.fs.unlink(part).catch(() => undefined);
    throw new Error(`asset ${asset.sha256.slice(0, 12)} → ${status}`);
  }
  const digest = await ReactNativeBlobUtil.fs.hash(part, 'sha256');
  if (digest !== asset.sha256) {
    await ReactNativeBlobUtil.fs.unlink(part).catch(() => undefined);
    throw new Error(
      `asset ${asset.sha256.slice(0, 12)} does not match its own hash`,
    );
  }
  const final = pathOf(asset.sha256, ext);
  await ReactNativeBlobUtil.fs.unlink(final).catch(() => undefined);
  await ReactNativeBlobUtil.fs.mv(part, final);
  held.set(asset.sha256, ext);
  if (isVectorAsset(asset)) {
    const body = await ReactNativeBlobUtil.fs
      .readFile(final, 'utf8')
      .catch(() => null);
    if (typeof body === 'string') {
      remember(asset.sha256, body);
    }
  }
  // Every picture draws the moment it is here, not when the batch ends.
  notify();
};

export type AssetProgress = { fetched: number; total: number };

// Which of these pictures the device does not hold. Cheap enough to ask on
// every check, so a picture lost to an interrupted write is noticed and
// fetched again long before a lesson needs it.
export const missingAssets = async <Ref extends AssetRef>(
  assets: Ref[],
): Promise<Ref[]> => {
  await whenHydrated();
  return assets.filter(asset => !held.has(asset.sha256));
};

// Makes sure every picture is on the device, downloading the ones that are
// not.
export const ensureAssets = async (
  assets: AssetRef[],
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
  // Twelve at once: the files are small, so the cost of a download is the
  // round trip, not the bytes — and HTTP/2 multiplexes them onto one
  // connection.
  await Promise.all(Array.from({ length: 12 }, () => worker()));
  notify();
};

// Forgets every stored picture except the ones named. Runs after a commit,
// so what a replaced version used goes with it.
export const sweepAssets = async (keep: Set<string>): Promise<void> => {
  await whenHydrated();
  for (const [sha256, ext] of [...held.entries()]) {
    if (!keep.has(sha256)) {
      await ReactNativeBlobUtil.fs
        .unlink(pathOf(sha256, ext))
        .catch(() => undefined);
      held.delete(sha256);
    }
  }
  for (const sha256 of [...bodies.keys()]) {
    if (!keep.has(sha256)) {
      cachedChars -= bodies.get(sha256)?.length ?? 0;
      bodies.delete(sha256);
    }
  }
  notify();
};

export const clearAssets = async (): Promise<void> => {
  await whenHydrated();
  await ReactNativeBlobUtil.fs.unlink(DIR).catch(() => undefined);
  await ReactNativeBlobUtil.fs.mkdir(DIR).catch(() => undefined);
  // The AsyncStorage generation's keys, in case a wipe runs before the
  // migration ever did.
  const keys = (await AsyncStorage.getAllKeys()).filter(key =>
    key.startsWith(`${PREFIX}/`),
  );
  if (keys.length > 0) {
    await AsyncStorage.removeMany(keys);
  }
  bodies.clear();
  cachedChars = 0;
  held = new Map();
  baseUrl = '';
  notify();
};

// Test seam: puts artwork on the device without a server.
export const primeVectorsForTests = async (
  entries: Iterable<[string, string]>,
): Promise<void> => {
  await whenHydrated();
  for (const [sha256, markup] of entries) {
    await ReactNativeBlobUtil.fs.writeFile(
      pathOf(sha256, 'svg'),
      markup,
      'utf8',
    );
    held.set(sha256, 'svg');
    remember(sha256, markup);
  }
};

export const primeRasterForTests = async (
  entries: Iterable<[string, Uint8Array]>,
): Promise<void> => {
  await whenHydrated();
  for (const [sha256, byteArray] of entries) {
    await ReactNativeBlobUtil.fs.writeFile(
      pathOf(sha256, 'png'),
      bytesToBase64(byteArray),
      'base64',
    );
    held.set(sha256, 'png');
  }
};

// Test seam: what a mounted card's read does, without React.
export const readForTests = (sha256: string): Promise<string | null> =>
  readBody(sha256);

// Test seam.
export const resetAssetsForTests = (): void => {
  bodies.clear();
  cachedChars = 0;
  held = new Map();
  baseUrl = '';
  warmedOnce = false;
  hydration = null;
  listeners.clear();
  reads.clear();
};
