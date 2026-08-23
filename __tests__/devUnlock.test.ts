import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  hydrateDevUnlockAll,
  isDevUnlockAll,
  resetDevUnlockAllForTests,
  setDevUnlockAll,
} from '@/lib/devUnlock';

const KEY = 'dmv-prep/dev-unlock-all/v1';

beforeEach(async () => {
  await AsyncStorage.clear();
  resetDevUnlockAllForTests();
});

describe('dev unlock override', () => {
  it('is off until switched on', () => {
    expect(isDevUnlockAll()).toBe(false);
  });

  it('persists the flag so it survives a reload', async () => {
    setDevUnlockAll(true);
    expect(isDevUnlockAll()).toBe(true);
    expect(await AsyncStorage.getItem(KEY)).toBe('1');

    // A fresh launch restores it.
    resetDevUnlockAllForTests();
    expect(isDevUnlockAll()).toBe(false);
    await hydrateDevUnlockAll();
    expect(isDevUnlockAll()).toBe(true);
  });

  it('turns back off and clears the stored flag', async () => {
    setDevUnlockAll(true);
    setDevUnlockAll(false);
    expect(isDevUnlockAll()).toBe(false);
    expect(await AsyncStorage.getItem(KEY)).toBe('0');

    resetDevUnlockAllForTests();
    await hydrateDevUnlockAll();
    expect(isDevUnlockAll()).toBe(false);
  });

  it('stays locked when the stored flag is unreadable', async () => {
    const spy = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValueOnce(new Error('boom'));
    await hydrateDevUnlockAll();
    expect(isDevUnlockAll()).toBe(false);
    spy.mockRestore();
  });
});
