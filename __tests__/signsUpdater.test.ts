import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchSignsDocRaw, fetchSignsLatestRaw } from '@/data/signs/client';
import {
  findCategory,
  findSign,
  signCategories,
  signs,
  signsByCategory,
  signsDeliveryVersion,
} from '@/data/signs';
import { signsStore } from '@/data/signs/store';
import { runSignsUpdate } from '@/data/signs/updater';
import type { SignsDoc, SignsLatestResponse } from '@/data/signs/wire';
import { sha256Hex, utf8ByteLength } from '@/lib/sha256';

// Fixture versions must sit above whatever the bundled seed ships, or the
// updater correctly reports "up-to-date" and the tests never exercise an
// update. Derived so a seed bump does not silently disable them.
const SEED_MAJOR = Number(signsDeliveryVersion.split('.')[0]);
const NEXT_VERSION = `${SEED_MAJOR + 1}.0.0`;

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

// A tiny but wire-valid catalogue fixture.
const fixtureDoc = (deliveryVersion: string): SignsDoc => ({
  schemaVersion: 1,
  deliveryVersion,
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
      name: 'Stop (updated)',
      code: 'R1-1',
      description: 'Come to a complete stop.',
      steps: ['Stop fully before the limit line'],
      trap: 'Rolling through slowly is still a violation.',
      art: { kind: 'octagon', label: 'STOP' },
    },
  ],
});

const serve = (doc: SignsDoc, overrides: Partial<SignsLatestResponse> = {}) => {
  const body = JSON.stringify(doc);
  const latest: SignsLatestResponse = {
    latestVersion: doc.deliveryVersion,
    minAppVersion: '1.0.0',
    document: { sha256: sha256Hex(body), sizeBytes: utf8ByteLength(body) },
    ...overrides,
  };
  mockLatest.mockResolvedValue(JSON.stringify(latest));
  mockDoc.mockResolvedValue(body);
  return body;
};

beforeEach(async () => {
  await AsyncStorage.clear();
  signsStore.resetForTests();
  mockLatest.mockReset();
  mockDoc.mockReset();
});

describe('runSignsUpdate', () => {
  it('commits a newer verified catalogue and serves it everywhere', async () => {
    serve(fixtureDoc(NEXT_VERSION));

    const result = await runSignsUpdate();

    expect(result.status).toBe('updated');
    expect(signsStore.getSnapshot().deliveryVersion).toBe(NEXT_VERSION);
    // The live bindings and lookups all serve the committed catalogue.
    expect(signsDeliveryVersion).toBe(NEXT_VERSION);
    expect(signs.map(sign => sign.name)).toEqual(['Stop (updated)']);
    expect(signCategories[0].name).toBe('Regulatory (updated)');
    expect(findSign('stop')?.name).toBe('Stop (updated)');
    expect(findCategory('regulatory')?.name).toBe('Regulatory (updated)');
    expect(signsByCategory('regulatory')).toHaveLength(1);
  });

  it('reports up-to-date without fetching the doc when versions match', async () => {
    const doc = fixtureDoc(signsDeliveryVersion);
    serve(doc, { latestVersion: signsDeliveryVersion });

    const result = await runSignsUpdate();

    expect(result.status).toBe('up-to-date');
    expect(mockDoc).not.toHaveBeenCalled();
  });

  it('refuses a catalogue that needs a newer app', async () => {
    serve(fixtureDoc(NEXT_VERSION), { minAppVersion: '9.0.0' });

    const result = await runSignsUpdate();

    expect(result.status).toBe('app-update-required');
    expect(mockDoc).not.toHaveBeenCalled();
    expect(signsStore.getSnapshot().deliveryVersion).toBe(signsDeliveryVersion);
  });

  it('commits nothing on a hash mismatch', async () => {
    serve(fixtureDoc(NEXT_VERSION), {
      document: { sha256: 'a'.repeat(64), sizeBytes: 3 },
    });

    const result = await runSignsUpdate();

    expect(result.status).toBe('failed');
    expect(signsStore.getSnapshot().deliveryVersion).toBe(signsDeliveryVersion);
    expect(await AsyncStorage.getItem('dmv-prep/signs/v1/meta')).toBeNull();
  });

  it('commits nothing when the doc fails structural validation', async () => {
    const doc = fixtureDoc(NEXT_VERSION);
    (doc.signs[0] as { art: unknown }).art = { kind: 'hexagon' };
    serve(doc);

    const result = await runSignsUpdate();

    expect(result.status).toBe('failed');
    expect(signsStore.getSnapshot().deliveryVersion).toBe(signsDeliveryVersion);
  });

  it('reports offline when the latest check cannot be reached', async () => {
    mockLatest.mockRejectedValue(new Error('network down'));

    const result = await runSignsUpdate();

    expect(result.status).toBe('offline');
  });

  it('survives a garbage latest response', async () => {
    mockLatest.mockResolvedValue('not json');

    expect((await runSignsUpdate()).status).toBe('failed');

    mockLatest.mockResolvedValue(JSON.stringify({ latestVersion: 'nope' }));
    expect((await runSignsUpdate()).status).toBe('failed');
  });

  it('hydrates the committed catalogue after a restart', async () => {
    serve(fixtureDoc(NEXT_VERSION));
    await runSignsUpdate();

    // A fresh process: in-memory state gone, storage intact.
    signsStore.resetForTests();
    expect(signsStore.getSnapshot().deliveryVersion).toBe(signsDeliveryVersion);

    await signsStore.hydrate();

    expect(signsStore.getSnapshot().deliveryVersion).toBe(NEXT_VERSION);
    expect(findSign('stop')?.name).toBe('Stop (updated)');
  });

  it('falls back to the seed when the stored doc is corrupted', async () => {
    serve(fixtureDoc(NEXT_VERSION));
    await runSignsUpdate();

    await AsyncStorage.setItem(
      `dmv-prep/signs/v1/${NEXT_VERSION}/doc`,
      '{"broken": true}',
    );
    signsStore.resetForTests();
    await signsStore.hydrate();

    expect(signsStore.getSnapshot().deliveryVersion).toBe(signsDeliveryVersion);
    // The bad pointer is cleared so the next update can recommit.
    expect(await AsyncStorage.getItem('dmv-prep/signs/v1/meta')).toBeNull();
  });
});
