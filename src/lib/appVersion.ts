import DeviceInfo from 'react-native-device-info';

import { parseSemver } from '@/data/course/semver';

// The release version baked into this build — CFBundleShortVersionString on
// iOS, versionName on Android. Read out of the binary instead of kept as a
// hand-edited constant, so it can never drift from what the store actually
// shipped (it did: the literal here said 1.0.0 for a 1.2.0 build).
//
// null when the native module cannot answer (jest, an unlinked build) or the
// value is not a plain "1.2.3". Callers must treat that as "unknown version"
// and skip every comparison: an unparseable version reads as older than
// everything to isVersionBelow, which would nag for an update forever.
const read = (): string | null => {
  try {
    const version = DeviceInfo.getVersion();
    return parseSemver(version) != null ? version : null;
  } catch {
    return null;
  }
};

export const INSTALLED_APP_VERSION: string | null = read();
