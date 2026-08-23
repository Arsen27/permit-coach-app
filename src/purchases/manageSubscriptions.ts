import { Alert, Linking, Platform } from 'react-native';

import Purchases from 'react-native-purchases';

import { isRevenueCatSdkReady } from './client';

// "Manage Subscription" never cancels anything itself — it hands the learner
// to Apple's or Google's own subscription management, which is the only place
// a store subscription can actually be cancelled. It must work whatever the
// entitlement state is (active, cancelled-but-entitled, or still unknown), so
// nothing here reads CustomerInfo first.

// Account-level pages — deliberately no product id in either URL: the store
// shows all of the account's subscriptions, this app's included.
export const APPLE_SUBSCRIPTIONS_URL =
  'https://apps.apple.com/account/subscriptions';
export const GOOGLE_SUBSCRIPTIONS_URL =
  'https://play.google.com/store/account/subscriptions?package=app.permitcoach';

export const storeSubscriptionsUrl = (platform: 'ios' | 'android'): string =>
  platform === 'ios' ? APPLE_SUBSCRIPTIONS_URL : GOOGLE_SUBSCRIPTIONS_URL;

const showFailureAlert = (): void => {
  Alert.alert(
    'Unable to open subscriptions',
    'Open your App Store or Google Play account settings to manage your subscription.',
  );
};

export const openManageSubscriptions = async (): Promise<void> => {
  // Preferred path: the RevenueCat SDK's own bridge to the platform's
  // subscription manager (the App Store sheet on iOS, Play subscriptions on
  // Android). Only valid once configure() has run this launch.
  if (isRevenueCatSdkReady()) {
    try {
      await Purchases.showManageSubscriptions();
      return;
    } catch {
      // Fall through to the plain store URL.
    }
  }

  const url = storeSubscriptionsUrl(Platform.OS === 'ios' ? 'ios' : 'android');
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      showFailureAlert();
      return;
    }
    await Linking.openURL(url);
  } catch {
    showFailureAlert();
  }
};
