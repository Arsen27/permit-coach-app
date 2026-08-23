import { Platform } from 'react-native';

import Purchases, { LOG_LEVEL } from 'react-native-purchases';

import { createLogger } from '@/lib/log';
import {
  REVENUECAT_VERBOSE_LOGGING,
  resolveRevenueCatApiKey,
} from '@/lib/revenueCatConfig';

const log = createLogger('purchases', REVENUECAT_VERBOSE_LOGGING);

const isDevBuild = typeof __DEV__ !== 'undefined' && __DEV__;
const platform = Platform.OS === 'ios' ? 'ios' : 'android';

export const revenueCatApiKey = resolveRevenueCatApiKey(platform, isDevBuild);
export const isRevenueCatConfigured = revenueCatApiKey.length > 0;

// RevenueCat must be configured exactly once per process. Subsequent identity
// changes use logIn/logOut; configuring twice can produce competing delegates
// and stale entitlement state in the native SDK.
let sdkConfigured = false;

export const ensureRevenueCatConfigured = (appUserID: string | null): void => {
  if (!sdkConfigured && isRevenueCatConfigured) {
    // Must precede configure() to catch the offerings fetch. The SDK narrates
    // exactly why a paywall came up empty — which is otherwise invisible in a
    // TestFlight build, where there is no Metro console to read.
    if (isDevBuild || REVENUECAT_VERBOSE_LOGGING) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    // Key prefix only — never the key itself. Which store the build ended up
    // talking to is the first thing worth knowing when a paywall comes up
    // empty, and it is invisible from the outside.
    log.info('configuring', {
      platform,
      store: revenueCatApiKey.startsWith('appl_')
        ? 'app_store'
        : revenueCatApiKey.startsWith('goog_')
        ? 'play_store'
        : 'test_store',
      keyPrefix: revenueCatApiKey.slice(0, 5),
      identified: appUserID != null,
    });
    Purchases.configure({ apiKey: revenueCatApiKey, appUserID });
    sdkConfigured = true;
  }
};

// Whether SDK calls (showManageSubscriptions etc.) are safe to make right
// now — configure() has actually run this launch, not just could run.
export const isRevenueCatSdkReady = (): boolean =>
  sdkConfigured && isRevenueCatConfigured;

// Account deletion and store-subscription cancellation are separate. Logging
// out here only detaches the deleted PermitCoach UUID before the app creates a
// fresh anonymous Supabase account; it does not cancel an Apple/Google
// subscription. The server can then erase the old RevenueCat customer without
// racing a new Supabase UUID being aliased onto it.
export const detachRevenueCatIdentity = async (): Promise<boolean> => {
  if (!sdkConfigured || !isRevenueCatConfigured) {
    return true;
  }
  try {
    await Purchases.logOut();
    return true;
  } catch {
    return false;
  }
};
