import DeviceInfo from 'react-native-device-info';

// The release version baked into this build — CFBundleShortVersionString on
// iOS, versionName on Android. Read out of the binary instead of kept as a
// hand-edited constant, so it can never drift from what the store actually
// shipped (it did: the literal here said 1.0.0 for a 1.2.0 build).
//
// Apple is happy with a one- or two-part version ("1.1"), but every
// comparison in the app and on the server speaks x.y.z — so missing parts
// are read as zeros rather than treating the whole build as versionless,
// which would silently disable the new-version check.
//
// null when the native module cannot answer (jest, an unlinked build) or the
// value is not plain digits-and-dots. Callers must treat that as "unknown
// version" and skip every comparison: an unparseable version reads as older
// than everything to isVersionBelow, which would nag for an update forever.
export const normalizeAppVersion = (value: string): string | null => {
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(value.trim());
  if (match == null) {
    return null;
  }
  return `${Number(match[1])}.${Number(match[2] ?? 0)}.${Number(
    match[3] ?? 0,
  )}`;
};

const read = (): string | null => {
  try {
    return normalizeAppVersion(DeviceInfo.getVersion());
  } catch {
    return null;
  }
};

export const INSTALLED_APP_VERSION: string | null = read();
