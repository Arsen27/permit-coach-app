import AsyncStorage from '@react-native-async-storage/async-storage';

// One-shot onboarding flag. Absent ⇒ show onboarding (the app has no
// production users from before the flag existed, so no migration shim).

const KEY = 'dmv-prep/onboarding-done/v1';

export const isOnboardingDone = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(KEY)) != null;
  } catch {
    return true;
  }
};

export const markOnboardingDone = async (): Promise<void> => {
  await AsyncStorage.setItem(KEY, '1');
};
