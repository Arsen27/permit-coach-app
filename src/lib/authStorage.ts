import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

// Storage adapter for the Supabase auth session. Backed by the iOS Keychain
// (Android Keystore), which survives app uninstall on iOS — that is what lets
// an anonymous user's progress come back after delete + reinstall, without an
// account. Falls back to AsyncStorage where the keychain is unavailable.
//
// Deliberately NOT synchronizable to iCloud Keychain: the session should stay
// on this device; cross-device is what real accounts are for.

type AuthStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const serviceFor = (key: string): string => `dmv-prep/${key}`;

export const authStorage: AuthStorage = {
  getItem: async key => {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: serviceFor(key),
      });
      return credentials ? credentials.password : null;
    } catch {
      return AsyncStorage.getItem(key).catch(() => null);
    }
  },
  setItem: async (key, value) => {
    try {
      await Keychain.setGenericPassword('supabase', value, {
        service: serviceFor(key),
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK,
      });
    } catch {
      await AsyncStorage.setItem(key, value).catch(() => undefined);
    }
  },
  removeItem: async key => {
    try {
      await Keychain.resetGenericPassword({ service: serviceFor(key) });
    } catch {
      await AsyncStorage.removeItem(key).catch(() => undefined);
    }
  },
};
