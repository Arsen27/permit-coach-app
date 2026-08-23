import {
  REVENUECAT_APPLE_API_KEY,
  REVENUECAT_TEST_API_KEY,
  resolveRevenueCatApiKey,
} from '@/lib/revenueCatConfig';

describe('RevenueCat release configuration', () => {
  it('uses the Test Store only in development', () => {
    expect(resolveRevenueCatApiKey('ios', true)).toBe(REVENUECAT_TEST_API_KEY);
  });

  it('always uses the App Store key in an iOS release', () => {
    expect(resolveRevenueCatApiKey('ios', false)).toBe(
      REVENUECAT_APPLE_API_KEY,
    );
    expect(resolveRevenueCatApiKey('ios', false)).not.toMatch(/^(test_|rcb_)/);
  });

  it('keeps Android purchases disabled until its production key is supplied', () => {
    expect(resolveRevenueCatApiKey('android', false)).toBe('');
  });
});
