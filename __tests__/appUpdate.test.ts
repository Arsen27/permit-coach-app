import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

import {
  CHECK_INTERVAL_MS,
  checkForAppUpdate,
  openStoreListing,
  parseRelease,
  RELEASE_PATH,
} from '@/lib/appUpdate';

// The installed build is pinned here rather than taken from the native mock,
// so "is there something newer" is expressed against a fixed baseline.
jest.mock('@/lib/appVersion', () => ({ INSTALLED_APP_VERSION: '1.2.0' }));
jest.mock('@/lib/serverConfig', () => ({
  SERVER_URL: 'http://test',
  isServerConfigured: false,
  isReleaseCheckConfigured: true,
  APP_VERSION: '1.2.0',
}));

const CHECK_KEY = 'dmv-prep/app-update-check/v1';

// Any wall-clock timestamp past the first day of the epoch; a smaller number
// would look like "already checked today" to the throttle.
const T0 = 1_700_000_000_000;

const okResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body } as Response);

const fetchMock = jest.fn();

beforeEach(async () => {
  await AsyncStorage.clear();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('release payload validation', () => {
  it('accepts a well-formed release', () => {
    expect(
      parseRelease({
        latestVersion: '1.3.0',
        storeUrl: 'https://apps.apple.com/app/id123',
      }),
    ).toEqual({
      latestVersion: '1.3.0',
      storeUrl: 'https://apps.apple.com/app/id123',
    });
  });

  it('rejects anything it would not be safe to act on', () => {
    const url = 'https://apps.apple.com/app/id123';
    for (const bad of [
      null,
      'nonsense',
      {},
      { latestVersion: '1.3.0' },
      { storeUrl: url },
      // Not a plain semver: comparison would be meaningless.
      { latestVersion: 'v1.3', storeUrl: url },
      { latestVersion: 1.3, storeUrl: url },
      // Non-https schemes never reach Linking.openURL.
      { latestVersion: '1.3.0', storeUrl: 'itms-apps://buy' },
      { latestVersion: '1.3.0', storeUrl: 'http://apps.apple.com/app/id123' },
      { latestVersion: '1.3.0', storeUrl: 'intent://scan/#Intent;end' },
      { latestVersion: '1.3.0', storeUrl: 42 },
    ]) {
      expect(parseRelease(bad)).toBeNull();
    }
  });
});

describe('checkForAppUpdate', () => {
  it('reports the newer release and asks the right endpoint', async () => {
    fetchMock.mockResolvedValue(
      okResponse({
        latestVersion: '1.3.0',
        storeUrl: 'https://apps.apple.com/app/id123',
      }),
    );

    const release = await checkForAppUpdate(T0);

    expect(release).toEqual({
      latestVersion: '1.3.0',
      storeUrl: 'https://apps.apple.com/app/id123',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `http://test${RELEASE_PATH}?platform=ios`,
    );
  });

  it('stays quiet when the store is at or below the installed version', async () => {
    for (const latestVersion of ['1.2.0', '1.1.9']) {
      await AsyncStorage.clear();
      fetchMock.mockResolvedValue(
        okResponse({ latestVersion, storeUrl: 'https://apps.apple.com/x' }),
      );
      expect(await checkForAppUpdate(T0)).toBeNull();
    }
  });

  it('asks the server at most once a day', async () => {
    fetchMock.mockResolvedValue(
      okResponse({
        latestVersion: '1.3.0',
        storeUrl: 'https://apps.apple.com/app/id123',
      }),
    );
    const start = T0;

    expect(await checkForAppUpdate(start)).not.toBeNull();
    expect(await checkForAppUpdate(start + 60_000)).toBeNull();
    expect(await checkForAppUpdate(start + CHECK_INTERVAL_MS - 1)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A day later the prompt is due again.
    expect(await checkForAppUpdate(start + CHECK_INTERVAL_MS)).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not burn the day when the request fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await checkForAppUpdate(T0)).toBeNull();
    expect(await AsyncStorage.getItem(CHECK_KEY)).toBeNull();

    fetchMock.mockResolvedValueOnce(
      okResponse({
        latestVersion: '1.3.0',
        storeUrl: 'https://apps.apple.com/app/id123',
      }),
    );
    expect(await checkForAppUpdate(T0 + 100)).not.toBeNull();
  });

  it('ignores an error status and an unusable payload', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 } as Response);
    expect(await checkForAppUpdate(T0)).toBeNull();

    fetchMock.mockResolvedValueOnce(okResponse({ latestVersion: 'garbage' }));
    expect(await checkForAppUpdate(T0 + 100)).toBeNull();
    expect(await AsyncStorage.getItem(CHECK_KEY)).toBeNull();
  });

  it('collapses concurrent checks into one request', async () => {
    fetchMock.mockResolvedValue(
      okResponse({
        latestVersion: '1.3.0',
        storeUrl: 'https://apps.apple.com/app/id123',
      }),
    );

    const [a, b] = await Promise.all([
      checkForAppUpdate(T0),
      checkForAppUpdate(T0),
    ]);

    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('openStoreListing', () => {
  it('hands the URL to the OS and swallows a failure', async () => {
    const openURL = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('no handler'));

    await openStoreListing('https://apps.apple.com/app/id123');
    expect(openURL).toHaveBeenCalledWith('https://apps.apple.com/app/id123');

    await expect(
      openStoreListing('https://apps.apple.com/app/id123'),
    ).resolves.toBeUndefined();

    openURL.mockRestore();
  });
});
