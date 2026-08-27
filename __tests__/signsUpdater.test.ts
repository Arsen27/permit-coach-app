import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  findCategory,
  findSign,
  signCategories,
  signs,
  signsByCategory,
  signsCatalogHash,
} from '@/data/signs';
import { fetchSignsDocRaw, fetchSignsLatestRaw } from '@/data/signs/client';
import { signsStore } from '@/data/signs/store';
import { runSignsUpdate } from '@/data/signs/updater';
import type { SignsCatalogRef, SignsDoc } from '@/data/signs/wire';
import { sha256Hex, utf8ByteLength } from '@/lib/sha256';

jest.mock('@/data/signs/client');
jest.mock('@/lib/serverConfig', () => ({
  SERVER_URL: 'http://test',
  isServerConfigured: true,
  isReleaseCheckConfigured: true,
  APP_VERSION: '1.0.0',
}));

const mockLatest = fetchSignsLatestRaw as jest.MockedFunction<
  typeof fetchSignsLatestRaw
>;
const mockDoc = fetchSignsDocRaw as jest.MockedFunction<
  typeof fetchSignsDocRaw
>;

// A tiny but wire-valid catalogue fixture. Any edit gives it a different
// sha256, which is the whole update trigger now that nothing is versioned.
const fixtureDoc = (name = 'Stop (updated)'): SignsDoc => ({
  schemaVersion: 1,
  categories: [
    {
      id: 'regulatory',
      name: 'Regulatory (updated)',
      subtitle: 'rules you must obey',
      blurb: 'White and red signs state traffic laws.',
      color: '#C8102E',
      glyph: 'octagon',
    },
  ],
  signs: [
    {
      id: 'stop',
      categoryId: 'regulatory',
      name,
      code: 'R1-1',
      description: 'Come to a complete stop.',
      steps: ['Stop fully before the limit line'],
      trap: 'Rolling through slowly is still a violation.',
      image: {
        full: { assetId: 'a'.repeat(64), mime: 'image/svg+xml', sizeBytes: 512 },
      },
    },
  ],
});

const serve = (doc: SignsDoc, overrides: Partial<SignsCatalogRef> = {}) => {
  const body = JSON.stringify(doc);
  const latest: SignsCatalogRef = {
    sha256: sha256Hex(body),
    sizeBytes: utf8ByteLength(body),
    updatedAt: '2026-08-27T00:00:00.000Z',
    ...overrides,
  };
  mockLatest.mockResolvedValue(JSON.stringify(latest));
  mockDoc.mockResolvedValue(body);
  return { body, sha256: latest.sha256 };
};

const SEED_HASH = signsCatalogHash;

beforeEach(async () => {
  await AsyncStorage.clear();
  signsStore.resetForTests();
  mockLatest.mockReset();
  mockDoc.mockReset();
});

describe('runSignsUpdate', () => {
  it('commits a published catalogue and serves it everywhere', async () => {
    const { sha256 } = serve(fixtureDoc());

    const result = await runSignsUpdate();

    expect(result.status).toBe('updated');
    expect(signsStore.getSnapshot().sha256).toBe(sha256);
    // The live bindings and lookups all serve the committed catalogue.
    expect(signsCatalogHash).toBe(sha256);
    expect(signs.map(sign => sign.name)).toEqual(['Stop (updated)']);
    expect(signCategories[0].name).toBe('Regulatory (updated)');
    expect(findSign('stop')?.name).toBe('Stop (updated)');
    expect(findCategory('regulatory')?.name).toBe('Regulatory (updated)');
    expect(signsByCategory('regulatory')).toHaveLength(1);
  });

  it('does not fetch the document when the hash already matches', async () => {
    // Whatever the store currently serves, published unchanged.
    const snapshot = signsStore.getSnapshot();
    mockLatest.mockResolvedValue(
      JSON.stringify({
        sha256: snapshot.sha256,
        sizeBytes: 10,
        updatedAt: '2026-08-27T00:00:00.000Z',
      }),
    );

    const result = await runSignsUpdate();

    expect(result.status).toBe('up-to-date');
    expect(mockDoc).not.toHaveBeenCalled();
  });

  // Unversioned delivery means a revert is just another set of bytes, and it
  // must travel exactly like a forward edit.
  it('takes a rollback as readily as an edit', async () => {
    const forward = serve(fixtureDoc('Stop (edited)'));
    await runSignsUpdate();
    expect(findSign('stop')?.name).toBe('Stop (edited)');

    const back = serve(fixtureDoc('Stop'));
    expect(back.sha256).not.toBe(forward.sha256);

    expect((await runSignsUpdate()).status).toBe('updated');
    expect(findSign('stop')?.name).toBe('Stop');
  });

  it('commits nothing on a hash mismatch', async () => {
    serve(fixtureDoc(), { sha256: 'a'.repeat(64) });

    const result = await runSignsUpdate();

    expect(result.status).toBe('failed');
    expect(signsStore.getSnapshot().sha256).toBe(SEED_HASH);
    expect(await AsyncStorage.getItem('dmv-prep/signs/v1/meta')).toBeNull();
  });

  it('commits nothing on a size mismatch', async () => {
    serve(fixtureDoc(), { sizeBytes: 3 });

    expect((await runSignsUpdate()).status).toBe('failed');
    expect(signsStore.getSnapshot().sha256).toBe(SEED_HASH);
  });

  it('commits nothing when the doc fails structural validation', async () => {
    const doc = fixtureDoc();
    (doc.signs[0] as { image: unknown }).image = { full: { mime: 'image/gif' } };
    serve(doc);

    expect((await runSignsUpdate()).status).toBe('failed');
    expect(signsStore.getSnapshot().sha256).toBe(SEED_HASH);
  });

  it('reports offline when the latest check cannot be reached', async () => {
    mockLatest.mockRejectedValue(new Error('network down'));

    expect((await runSignsUpdate()).status).toBe('offline');
  });

  it('survives a garbage latest response', async () => {
    mockLatest.mockResolvedValue('not json');
    expect((await runSignsUpdate()).status).toBe('failed');

    mockLatest.mockResolvedValue(JSON.stringify({ sha256: 'nope' }));
    expect((await runSignsUpdate()).status).toBe('failed');
  });

  it('hydrates the committed catalogue after a restart', async () => {
    const { sha256 } = serve(fixtureDoc());
    await runSignsUpdate();

    // A fresh process: in-memory state gone, storage intact.
    signsStore.resetForTests();
    expect(signsStore.getSnapshot().sha256).toBe(SEED_HASH);

    await signsStore.hydrate();

    expect(signsStore.getSnapshot().sha256).toBe(sha256);
    expect(findSign('stop')?.name).toBe('Stop (updated)');
  });

  it('falls back to the seed when the stored bytes no longer match their hash', async () => {
    const { sha256 } = serve(fixtureDoc());
    await runSignsUpdate();

    await AsyncStorage.setItem(
      `dmv-prep/signs/v1/${sha256}/doc`,
      JSON.stringify(fixtureDoc('Tampered')),
    );
    signsStore.resetForTests();
    await signsStore.hydrate();

    expect(signsStore.getSnapshot().sha256).toBe(SEED_HASH);
    // The bad pointer is cleared so the next check can recommit.
    expect(await AsyncStorage.getItem('dmv-prep/signs/v1/meta')).toBeNull();
  });
});

describe('sign artwork', () => {
  const withImage = (image: unknown): SignsDoc => {
    const doc = fixtureDoc();
    (doc.signs[0] as { image: unknown }).image = image;
    return doc;
  };

  const asset = (assetId = 'b'.repeat(64), mime = 'image/png') => ({
    assetId,
    mime,
    sizeBytes: 2048,
  });

  it('carries a full image and an optional thumbnail through the wire', async () => {
    serve(
      withImage({
        full: asset(),
        thumb: asset('c'.repeat(64), 'image/svg+xml'),
      }),
    );

    expect((await runSignsUpdate()).status).toBe('updated');

    const stored = findSign('stop');
    expect(stored?.image.full.mime).toBe('image/png');
    expect(stored?.image.thumb?.mime).toBe('image/svg+xml');
  });

  it('accepts a full image with no thumbnail', async () => {
    serve(withImage({ full: asset('d'.repeat(64), 'image/jpeg') }));

    expect((await runSignsUpdate()).status).toBe('updated');
    expect(findSign('stop')?.image.thumb).toBeUndefined();
  });

  // Artwork is the sign, so a sign without any is not a sign.
  it('refuses a sign with no image at all', async () => {
    const doc = fixtureDoc();
    delete (doc.signs[0] as { image?: unknown }).image;
    serve(doc);

    expect((await runSignsUpdate()).status).toBe('failed');
  });

  it('refuses an asset id that is not its own sha256', async () => {
    serve(withImage({ full: asset('not-a-hash') }));

    expect((await runSignsUpdate()).status).toBe('failed');
  });

  it('refuses an unsupported image format', async () => {
    serve(withImage({ full: asset('e'.repeat(64), 'image/gif') }));

    expect((await runSignsUpdate()).status).toBe('failed');
  });
});
