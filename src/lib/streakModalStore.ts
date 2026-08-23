import AsyncStorage from '@react-native-async-storage/async-storage';

// Local calendar date the daily streak modal was last shown for, per user.
// Device-local and never synced: "first open today" is a property of this
// device, not of the account.

const key = (userId: string) => `dmv-prep/streak-modal/v1/${userId}`;

export const wasStreakModalShown = async (
  userId: string,
  date: string,
): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(key(userId))) === date;
  } catch {
    // Unreadable store: skip the modal rather than risk showing it on every
    // launch (the same posture as the onboarding flag).
    return true;
  }
};

export const markStreakModalShown = async (
  userId: string,
  date: string,
): Promise<void> => {
  try {
    await AsyncStorage.setItem(key(userId), date);
  } catch {
    // The in-session guard still prevents a repeat until the next launch.
  }
};
