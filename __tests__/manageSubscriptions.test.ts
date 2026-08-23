import { Alert, Linking, Platform } from 'react-native';

import Purchases from 'react-native-purchases';

import { ensureRevenueCatConfigured } from '@/purchases/client';
import {
  APPLE_SUBSCRIPTIONS_URL,
  GOOGLE_SUBSCRIPTIONS_URL,
  openManageSubscriptions,
  storeSubscriptionsUrl,
} from '@/purchases/manageSubscriptions';

// Ordering note: purchases/client keeps a module-level "configured once"
// flag, so every test that needs the SDK path *not* taken must run before
// the describe block that calls ensureRevenueCatConfigured.

const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
const canOpenSpy = jest.spyOn(Linking, 'canOpenURL');
const openSpy = jest.spyOn(Linking, 'openURL');
const showManage = Purchases.showManageSubscriptions as jest.Mock;

beforeEach(() => {
  alertSpy.mockClear();
  canOpenSpy.mockReset().mockResolvedValue(true);
  openSpy.mockReset().mockResolvedValue(undefined);
  showManage.mockClear().mockResolvedValue(undefined);
});

describe('storeSubscriptionsUrl', () => {
  it('points at the Apple account subscriptions page on iOS', () => {
    expect(storeSubscriptionsUrl('ios')).toBe(APPLE_SUBSCRIPTIONS_URL);
    expect(APPLE_SUBSCRIPTIONS_URL).toBe(
      'https://apps.apple.com/account/subscriptions',
    );
  });

  it('points at Google Play subscriptions for the app package on Android', () => {
    expect(storeSubscriptionsUrl('android')).toBe(GOOGLE_SUBSCRIPTIONS_URL);
    expect(GOOGLE_SUBSCRIPTIONS_URL).toBe(
      'https://play.google.com/store/account/subscriptions?package=app.permitcoach',
    );
  });
});

describe('openManageSubscriptions before the SDK is configured', () => {
  it('opens the iOS store URL directly', async () => {
    await openManageSubscriptions();
    expect(showManage).not.toHaveBeenCalled();
    expect(canOpenSpy).toHaveBeenCalledWith(APPLE_SUBSCRIPTIONS_URL);
    expect(openSpy).toHaveBeenCalledWith(APPLE_SUBSCRIPTIONS_URL);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('opens the Google Play URL on Android', async () => {
    const restore = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      await openManageSubscriptions();
      expect(openSpy).toHaveBeenCalledWith(GOOGLE_SUBSCRIPTIONS_URL);
    } finally {
      restore.restore();
    }
  });

  it('shows the fallback alert when the URL cannot be opened', async () => {
    canOpenSpy.mockResolvedValue(false);
    await openManageSubscriptions();
    expect(openSpy).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Unable to open subscriptions',
      'Open your App Store or Google Play account settings to manage your subscription.',
    );
  });

  it('shows the fallback alert when opening the URL throws', async () => {
    openSpy.mockRejectedValue(new Error('no browser'));
    await openManageSubscriptions();
    expect(alertSpy).toHaveBeenCalledWith(
      'Unable to open subscriptions',
      'Open your App Store or Google Play account settings to manage your subscription.',
    );
  });
});

describe('openManageSubscriptions once the SDK is configured', () => {
  beforeAll(() => {
    ensureRevenueCatConfigured('learner-1');
  });

  it("prefers RevenueCat's own bridge to the platform manager", async () => {
    await openManageSubscriptions();
    expect(showManage).toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('falls back to the store URL when the bridge fails', async () => {
    showManage.mockRejectedValue(new Error('native module unavailable'));
    await openManageSubscriptions();
    expect(openSpy).toHaveBeenCalledWith(APPLE_SUBSCRIPTIONS_URL);
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
