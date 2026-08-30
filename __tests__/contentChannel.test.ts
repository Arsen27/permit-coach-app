import AsyncStorage from '@react-native-async-storage/async-storage';

import { channelAnswers, fetchBootstrapRaw } from '@/data/course/client';
import {
  getContentChannel,
  getStagingKey,
  hydrateContentChannel,
  resetContentChannelForTests,
  setContentChannel,
  setStagingKey,
} from '@/lib/contentChannel';

jest.mock('@/lib/serverConfig', () => ({
  SERVER_URL: 'http://test',
  isServerConfigured: true,
  APP_VERSION: '1.0.0',
}));

// The dev-only content channel: which server channel this device downloads
// from, and the key that opens staging. Production is the only answer a
// release build can give.

const fetchMock = jest.fn();

beforeEach(async () => {
  await AsyncStorage.clear();
  resetContentChannelForTests();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => '{}',
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

const urlOf = (): string => fetchMock.mock.calls[0][0] as string;
const headersOf = (): Record<string, string> =>
  (fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers;

it('starts on production and asks the server for it', async () => {
  expect(getContentChannel()).toBe('production');

  await fetchBootstrapRaw('ca-class-c', '1.0.0', '1.2.0');

  expect(urlOf()).toContain('channel=production');
  expect(headersOf()['X-Staging-Key']).toBeUndefined();
});

it('switches to staging, wiping what the other channel put on the device', async () => {
  const wipe = jest.fn().mockResolvedValue(undefined);
  setStagingKey('key-123');
  await setContentChannel('staging', wipe);

  expect(wipe).toHaveBeenCalledTimes(1);
  expect(getContentChannel()).toBe('staging');

  await fetchBootstrapRaw('ca-class-c', null, '1.2.0');
  expect(urlOf()).toContain('channel=staging');
  expect(headersOf()['X-Staging-Key']).toBe('key-123');

  // Switching to the channel already in use changes nothing.
  await setContentChannel('staging', wipe);
  expect(wipe).toHaveBeenCalledTimes(1);
});

it('restores the channel and the key on the next launch', async () => {
  const wipe = jest.fn().mockResolvedValue(undefined);
  setStagingKey('key-123');
  await setContentChannel('staging', wipe);

  resetContentChannelForTests();
  expect(getContentChannel()).toBe('production');

  await hydrateContentChannel();

  expect(getContentChannel()).toBe('staging');
  expect(getStagingKey()).toBe('key-123');
});

it('is production in a release build whatever is stored', async () => {
  const wipe = jest.fn().mockResolvedValue(undefined);
  setStagingKey('key-123');
  await setContentChannel('staging', wipe);

  // @ts-expect-error __DEV__ is a global the bundler defines.
  globalThis.__DEV__ = false;
  try {
    expect(getContentChannel()).toBe('production');
    expect(getStagingKey()).toBe('');
    await fetchBootstrapRaw('ca-class-c', '1.0.0', '1.2.0');
    expect(urlOf()).toContain('channel=production');
    expect(headersOf()['X-Staging-Key']).toBeUndefined();

    // And nothing can switch it back on.
    await setContentChannel('staging', wipe);
    expect(getContentChannel()).toBe('production');
  } finally {
    // @ts-expect-error restoring the global for the rest of the suite.
    globalThis.__DEV__ = true;
  }
});

// Switching channels wipes the installed course before downloading the new
// one, so the question "does this channel answer?" has to be asked while
// there is still something to lose. A key one character short answers exactly
// like a channel that was never published.
describe('asking a channel whether it answers', () => {
  it('sends the key for the channel being asked about, not the stored one', async () => {
    setStagingKey('the-key');
    await channelAnswers('ca-class-c', 'staging', 'the-key');

    expect(urlOf()).toContain('channel=staging');
    expect(urlOf()).toContain('course=ca-class-c');
    expect(headersOf()['X-Staging-Key']).toBe('the-key');
  });

  it('sends no key when asking about production', async () => {
    await channelAnswers('ca-class-c', 'production', '');
    expect(headersOf()['X-Staging-Key']).toBeUndefined();
  });

  it('says no when the channel refuses, without throwing', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });
    await expect(
      channelAnswers('ca-class-c', 'staging', 'wrong'),
    ).resolves.toBe(false);
  });

  it('says no when the server cannot be reached at all', async () => {
    fetchMock.mockRejectedValue(new Error('Network request failed'));
    await expect(
      channelAnswers('ca-class-c', 'staging', 'the-key'),
    ).resolves.toBe(false);
  });

  it('says yes when the channel answers', async () => {
    await expect(
      channelAnswers('ca-class-c', 'staging', 'the-key'),
    ).resolves.toBe(true);
  });
});
