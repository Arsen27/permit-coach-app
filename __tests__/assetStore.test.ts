import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  assetPending,
  assetSource,
  readForTests,
  clearAssets,
  ensureAssets,
  hydrateAssets,
  missingAssets,
  primeRasterForTests,
  primeVectorsForTests,
  resetAssetsForTests,
  setAssetsBaseUrl,
  sweepAssets,
  vectorMarkup,
  warmAssets,
} from '@/data/assets/store';
import { bytesToBase64 } from '@/lib/base64';
import { sha256Hex, sha256HexOfBytes, utf8ByteLength } from '@/lib/sha256';

// Every picture a lesson shows lives on the device — a diagram as markup, a
// photograph as its bytes — because a course on the phone has to render on a
// plane. Both are verified against the hash the release named.

jest.mock('@/lib/serverConfig', () => ({
  SERVER_URL: 'http://test',
  isServerConfigured: true,
  APP_VERSION: '1.0.0',
}));

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

let fetchMock: jest.Mock;

beforeEach(async () => {
  await AsyncStorage.clear();
  resetAssetsForTests();
  await setAssetsBaseUrl('http://test/v1/assets');
  fetchMock = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes(vector.sha256)) {
      return { ok: true, status: 200, text: async () => SVG } as Response;
    }
    if (url.includes(raster.sha256)) {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => PNG_BYTES.buffer.slice(0),
      } as unknown as Response;
    }
    return { ok: false, status: 404, text: async () => '' } as Response;
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

it('keeps a photograph on the device, byte for byte', async () => {
  await ensureAssets([raster]);

  const source = assetSource(raster);
  expect(source).toEqual({
    kind: 'uri',
    uri: `data:image/png;base64,${bytesToBase64(PNG_BYTES)}`,
  });
  // On the device, not merely in memory.
  expect(await missingAssets([raster])).toEqual([]);
});

it('draws both kinds after a restart, with no network at all', async () => {
  await ensureAssets([vector, raster]);

  // The app is killed and launched again: storage survives, memory does not,
  // and there is no connection. This is the bug that put a placeholder on
  // every illustration — the files were on the device and nothing read them.
  resetAssetsForTests();
  globalThis.fetch = (async () => {
    throw new TypeError('Network request failed');
  }) as typeof fetch;
  await hydrateAssets();
  expect(await missingAssets([vector, raster])).toEqual([]);

  // What a mounted card does: read the body it needs, then draw.
  await readForTests(vector.sha256);
  await readForTests(raster.sha256);
  expect(vectorMarkup(vector)).toBe(SVG);
  expect(assetSource(raster)).toEqual({
    kind: 'uri',
    uri: `data:image/png;base64,${bytesToBase64(PNG_BYTES)}`,
  });
});

it('refuses a photograph whose bytes are not what the release promised', async () => {
  fetchMock.mockImplementation(async () => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
  }));

  await expect(ensureAssets([raster])).rejects.toThrow(/does not match/);
  expect(await missingAssets([raster])).toEqual([raster]);
});

it('refuses a diagram whose markup is not what the release promised', async () => {
  fetchMock.mockImplementation(async () => ({
    ok: true,
    status: 200,
    text: async () => '<svg/>',
  }));

  await expect(ensureAssets([vector])).rejects.toThrow(/does not match/);
  expect(await missingAssets([vector])).toEqual([vector]);
});

it('fetches only what is missing', async () => {
  await primeVectorsForTests([[vector.sha256, SVG]]);
  await ensureAssets([vector, raster]);

  const asked = fetchMock.mock.calls.map(call => String(call[0]));
  expect(asked.some(url => url.includes(raster.sha256))).toBe(true);
  expect(asked.some(url => url.includes(vector.sha256))).toBe(false);
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

it('stores a photograph through the blob road when arrayBuffer is refused', async () => {
  // React Native's fetch does not offer arrayBuffer everywhere; the Blob road
  // is the one that has always worked, and both must end in the same bytes.
  fetchMock.mockImplementation(async () => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => {
      throw new Error('not implemented');
    },
    blob: async () => 'blob',
  }));
  const chunks = `data:image/png;base64,${bytesToBase64(PNG_BYTES)}`;
  class FakeReader {
    result: string | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL() {
      this.result = chunks;
      this.onload?.();
    }
  }
  (globalThis as unknown as { FileReader: unknown }).FileReader = FakeReader;

  await ensureAssets([raster]);
  expect(assetSource(raster)).toEqual({
    kind: 'uri',
    uri: chunks,
  });
});

it('a raster primed on the device needs no network', async () => {
  await primeRasterForTests([[raster.sha256, PNG_BYTES]]);
  expect(assetSource(raster)?.kind).toBe('uri');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('reads a whole course of pictures in one burst, not batch after batch', async () => {
  // Enough to need several batches: a sequential read is what a learner saw
  // as an illustration arriving after the card.
  const many = Array.from({ length: 120 }, (_unused, index) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" id="s${index}"/>`;
    return { svg, sha256: sha256Hex(svg) };
  });
  await primeVectorsForTests(many.map(one => [one.sha256, one.svg]));
  resetAssetsForTests();

  let openReads = 0;
  let peak = 0;
  const real = AsyncStorage.getMany as jest.Mock;
  const impl = real.getMockImplementation()!;
  real.mockImplementation(async (keys: string[]) => {
    openReads += 1;
    peak = Math.max(peak, openReads);
    const result = await impl(keys);
    openReads -= 1;
    return result;
  });

  await warmAssets(many.map(one => one.sha256));
  real.mockImplementation(impl);

  expect(peak).toBeGreaterThan(1);
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
  expect(assetPending(raster)).toBe(false);
  expect(assetSource(vector)).toBeNull();

  await readForTests(vector.sha256);
  expect(assetPending(vector)).toBe(false);
  expect(assetSource(vector)).not.toBeNull();
});
