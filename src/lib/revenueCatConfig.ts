// RevenueCat public SDK keys (Project settings → API keys → "SDK API keys",
// one row per app: appl_… for App Store, goog_… for Google Play). These are
// publishable client keys, safe to ship in the bundle.
//
// NOT the "Secret API keys" (sk_…) listed on the same page — those grant full
// REST access to the project and belong only on the server, alongside the
// webhook auth header.
export const REVENUECAT_APPLE_API_KEY = 'appl_UpgndlMgYXZfDRqBfTQcZxILPsg';
export const REVENUECAT_GOOGLE_API_KEY = '';

// Test Store key (test_… / rcb_…). It is selected only in a __DEV__ build;
// release builds ignore it even when somebody accidentally leaves it filled
// in. One key covers every platform and simulates purchases.
export const REVENUECAT_TEST_API_KEY = 'test_FGlIOOKhTezdSOqMihOuCOoWqdN';

// Entitlement identifier configured in the RevenueCat dashboard. This is the
// entitlement's lookup key, matched verbatim against the keys of
// CustomerInfo.entitlements.active — a near miss reads as "never subscribed",
// which behind the hard onboarding paywall means nobody ever gets in.
export const PLUS_ENTITLEMENT_ID = 'PermitCoach Pro';

// Turns on RevenueCat's DEBUG logging in release builds too. Debug builds log
// regardless; this exists for diagnosing TestFlight, where there is no Metro
// console — read the output in Console.app with the device attached. Switch
// back off before shipping: the SDK logs offering and customer detail.
export const REVENUECAT_VERBOSE_LOGGING = true;

type RevenueCatPlatform = 'ios' | 'android';

const isTestStoreKey = (key: string): boolean =>
  key.startsWith('test_') || key.startsWith('rcb_');

// Pure and exported for a release-safety test. A Test Store key can never win
// in production, and a test key pasted into a platform slot fails loudly
// instead of silently shipping simulated purchases.
export const resolveRevenueCatApiKey = (
  platform: RevenueCatPlatform,
  isDevBuild: boolean,
): string => {
  const storeKey =
    platform === 'ios' ? REVENUECAT_APPLE_API_KEY : REVENUECAT_GOOGLE_API_KEY;

  if (!isDevBuild && isTestStoreKey(storeKey)) {
    throw new Error(
      `Refusing to use a RevenueCat Test Store key in a ${platform} release build.`,
    );
  }
  if (isDevBuild && REVENUECAT_TEST_API_KEY.length > 0) {
    return REVENUECAT_TEST_API_KEY;
  }
  return storeKey;
};
