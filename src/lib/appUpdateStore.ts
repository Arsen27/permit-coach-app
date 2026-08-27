import AsyncStorage from '@react-native-async-storage/async-storage';

// When the app last got an answer from the release endpoint. Device-local and
// not per-user: "how often do we ask the server" is a property of the install,
// and switching accounts is no reason to ask again.

const KEY = 'dmv-prep/app-update-check/v1';

export const lastAppUpdateCheckAt = async (): Promise<number> => {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    const parsed = stored == null ? NaN : Number(stored);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    // Unreadable store: treat it as never checked. The worst case is one
    // extra request per launch, which is cheaper than never checking at all.
    return 0;
  }
};

export const markAppUpdateChecked = async (at: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEY, String(at));
  } catch {
    // The in-session guard still keeps a single launch to one request.
  }
};
