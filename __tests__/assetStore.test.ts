import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';

import {
  artworkReady,
  assetPending,
  assetSource,
  clearAssets,
  ensureAssets,
  hydrateAssets,
  markArtworkReady,
  missingAssets,
  primeRasterForTests,
  primeVectorsForTests,
  readForTests,
  resetAssetsForTests,
  setAssetsBaseUrl,
  sweepAssets,
  vectorMarkup,
  warmAssets,
} from '@/data/assets/store';
import { bytesToBase64 } from '@/lib/base64';
import { sha256Hex, sha256HexOfBytes, utf8ByteLength } from '@/lib/sha256';

// Every picture a lesson shows lives on the device as a file named by the
// sha256 of its bytes. A diagram's markup is read into memory to be parsed;
// a photograph never crosses the bridge — its source is a file:// URI and
// the platform image pipeline does the rest. Both are verified against the
// hash the release named before they are kept.

jest.mock('@/lib/serverConfig', () => ({
  SERVER_URL: 'http://test',
  isServerConfigured: true,
  APP_VERSION: '1.0.0',
}));

type BlobDownload = (url: string) => Promise<{
  status: number;
  body?: string;
  encoding?: 'utf8' | 'base64';
}>;
const blob = ReactNativeBlobUtil as unknown as { __reset: () => void };
const setDownload = (handler: BlobDownload): jest.Mock => {
  const mock = jest.fn(handler);
  (globalThis as { __blobDownload?: BlobDownload }).__blobDownload = mock;
  return mock;
};

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"/>';
// A tiny but real PNG header plus payload — bytes that are not valid UTF-8,
// which is the whole point: text storage would mangle them.
const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0xfe, 0x7f, 0x01,
]);

const vector = {
  assetId: 'ca-a01',
  uuid: 'u1',
  mime: 'image/svg+xml' as const,
  width: 1200,
  height: 675,
  alt: 'a diagram',
  sha256: sha256Hex(SVG),
  sizeBytes: utf8ByteLength(SVG),
};

const raster = {
  assetId: 'ca-a02',
  uuid: 'u2',
  mime: 'image/png' as const,
  width: 1200,
  height: 675,
  alt: 'a photograph',
  sha256: sha256HexOfBytes(PNG_BYTES),
  sizeBytes: PNG_BYTES.length,
};

let downloads: jest.Mock;

beforeEach(async () => {
  await AsyncStorage.clear();
  blob.__reset();
  resetAssetsForTests();
  await setAssetsBaseUrl('http://test/v1/assets');
  downloads = setDownload(async url => {
    if (url.includes(vector.sha256)) {
      return { status: 200, body: SVG, encoding: 'utf8' };
    }
    if (url.includes(raster.sha256)) {
      return {
        status: 200,
        body: bytesToBase64(PNG_BYTES),
        encoding: 'base64',
      };
    }
    return { status: 404 };
  });
});

it('keeps a photograph as a file and serves its URI, no bridge involved', async () => {
  await ensureAssets([raster]);

  expect(assetSource(raster)).toEqual({
    kind: 'uri',
    uri: `file:///docs/content-assets/${raster.sha256}.png`,
  });
  expect(await missingAssets([raster])).toEqual([]);
});

it('draws both kinds after a restart, with no network at all', async () => {
  await ensureAssets([vector, raster]);

  // The app is killed and launched again: the files survive, memory does
  // not, and there is no connection.
  resetAssetsForTests();
  delete (globalThis as { __blobDownload?: unknown }).__blobDownload;
  await hydrateAssets();
  expect(await missingAssets([vector, raster])).toEqual([]);

  // What a mounted card does: read the markup it needs, then draw. The
  // photograph needs no read at all — being on the device is enough.
  await readForTests(vector.sha256);
  expect(vectorMarkup(vector)).toBe(SVG);
  expect(assetSource(raster)?.kind).toBe('uri');
});

it('refuses a photograph whose bytes are not what the release promised', async () => {
  setDownload(async () => ({
    status: 200,
    body: bytesToBase64(Uint8Array.from([1, 2, 3])),
    encoding: 'base64',
  }));

  await expect(ensureAssets([raster])).rejects.toThrow(/does not match/);
  expect(await missingAssets([raster])).toEqual([raster]);
  expect(assetSource(raster)).toBeNull();
});

it('refuses a diagram whose markup is not what the release promised', async () => {
  setDownload(async () => ({ status: 200, body: '<svg/>', encoding: 'utf8' }));

  await expect(ensureAssets([vector])).rejects.toThrow(/does not match/);
  expect(await missingAssets([vector])).toEqual([vector]);
});

it('fetches only what is missing', async () => {
  await primeVectorsForTests([[vector.sha256, SVG]]);
  await ensureAssets([vector, raster]);

  const asked = downloads.mock.calls.map(call => String(call[0]));
  expect(asked.some(url => url.includes(raster.sha256))).toBe(true);
  expect(asked.some(url => url.includes(vector.sha256))).toBe(false);
});

it('moves the AsyncStorage generation onto the file system, once', async () => {
  // An install from before the file store: a diagram as markup, a
  // photograph as base64, both under the old keys.
  await AsyncStorage.setItem(`dmv-prep/assets/v1/${vector.sha256}`, SVG);
  await AsyncStorage.setItem(
    `dmv-prep/assets/v1/${raster.sha256}`,
    bytesToBase64(PNG_BYTES),
  );

  await hydrateAssets();

  expect(await missingAssets([vector, raster])).toEqual([]);
  await readForTests(vector.sha256);
  expect(vectorMarkup(vector)).toBe(SVG);
  expect(assetSource(raster)?.kind).toBe('uri');
  // The old keys are gone — the migration runs once.
  const keys = await AsyncStorage.getAllKeys();
  expect(keys.filter(key => key.includes(vector.sha256))).toEqual([]);
});

it('a sweep keeps what is named and forgets the rest', async () => {
  await ensureAssets([vector, raster]);
  await sweepAssets(new Set([vector.sha256]));

  expect(await missingAssets([vector])).toEqual([]);
  expect(await missingAssets([raster])).toEqual([raster]);
  expect(vectorMarkup(vector)).toBe(SVG);
  expect(assetSource(raster)).toBeNull();
});

it('clearing takes everything, including where pictures come from', async () => {
  await ensureAssets([vector, raster]);
  await clearAssets();

  expect(await missingAssets([vector, raster])).toEqual([vector, raster]);
  expect(assetSource(vector)).toBeNull();
});

it('a raster primed on the device needs no network', async () => {
  await primeRasterForTests([[raster.sha256, PNG_BYTES]]);
  expect(assetSource(raster)?.kind).toBe('uri');
  expect(downloads).not.toHaveBeenCalled();
});

it('reads a whole course of diagrams in one burst', async () => {
  const many = Array.from({ length: 120 }, (_unused, index) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" id="s${index}"/>`;
    return { svg, sha256: sha256Hex(svg) };
  });
  await primeVectorsForTests(many.map(one => [one.sha256, one.svg]));
  resetAssetsForTests();
  await hydrateAssets();

  await warmAssets(
    many.map(one => ({ sha256: one.sha256, mime: 'image/svg+xml' })),
  );
  for (const one of many) {
    expect(
      assetSource({ sha256: one.sha256, mime: 'image/svg+xml' }),
    ).not.toBeNull();
  }
});

it('tells "still being read" apart from "not here"', async () => {
  await primeVectorsForTests([[vector.sha256, SVG]]);
  // A launch that has seen what the device holds but not read the bodies.
  resetAssetsForTests();
  await hydrateAssets();

  expect(assetPending(vector)).toBe(true);
  // A photograph is never pending: on the device means drawable.
  expect(assetPending(raster)).toBe(false);
  expect(assetSource(vector)).toBeNull();

  await readForTests(vector.sha256);
  expect(assetPending(vector)).toBe(false);
  expect(assetSource(vector)).not.toBeNull();
});

it('the shell may mount only after the warm-up has spoken', () => {
  expect(artworkReady()).toBe(false);
  markArtworkReady();
  expect(artworkReady()).toBe(true);
  resetAssetsForTests();
  expect(artworkReady()).toBe(false);
});
