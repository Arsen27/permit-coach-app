import { normalizeAppVersion } from '@/lib/appVersion';

// Xcode's Version field is allowed to say "1.1"; every comparison here and
// on the server speaks x.y.z. The gap is closed at the one place the binary
// is read, so a marketing version an operator likes cannot silently turn the
// update check off.
it('pads a short marketing version out to x.y.z', () => {
  expect(normalizeAppVersion('1.1')).toBe('1.1.0');
  expect(normalizeAppVersion('2')).toBe('2.0.0');
  expect(normalizeAppVersion('1.2.3')).toBe('1.2.3');
  expect(normalizeAppVersion(' 1.1 ')).toBe('1.1.0');
});

it('refuses what is not a version at all', () => {
  expect(normalizeAppVersion('1.1.0-beta')).toBeNull();
  expect(normalizeAppVersion('abc')).toBeNull();
  expect(normalizeAppVersion('')).toBeNull();
  expect(normalizeAppVersion('1.2.3.4')).toBeNull();
});
