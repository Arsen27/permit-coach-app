import { useEffect, useSyncExternalStore } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

// Dev-only override that opens every lesson and module test on the ladder so
// any card flow can be reached without grinding through the course in order.
//
// It is hard-disabled in release builds: `isUnlocked()` returns false unless
// __DEV__, so even a stored `true` (from a dev build on the same device)
// cannot leak into production behaviour. Device-local, never synced.

const KEY = 'dmv-prep/dev-unlock-all/v1';

let unlocked = false;
let hydrated = false;
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach(listener => listener());
};

export const isDevUnlockAll = (): boolean => __DEV__ && unlocked;

export const setDevUnlockAll = (next: boolean): void => {
  if (unlocked === next) {
    return;
  }
  unlocked = next;
  notify();
  AsyncStorage.setItem(KEY, next ? '1' : '0').catch(() => undefined);
};

// Restores the flag once per launch; safe to call from several components.
export const hydrateDevUnlockAll = async (): Promise<void> => {
  if (hydrated || !__DEV__) {
    return;
  }
  hydrated = true;
  try {
    if ((await AsyncStorage.getItem(KEY)) === '1') {
      unlocked = true;
      notify();
    }
  } catch {
    // Unreadable store — stay locked, which is the production behaviour.
  }
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// Self-hydrating: the first consumer to mount restores the stored flag.
export const useDevUnlockAll = (): boolean => {
  useEffect(() => {
    hydrateDevUnlockAll();
  }, []);

  return useSyncExternalStore(subscribe, isDevUnlockAll);
};

// Test seam.
export const resetDevUnlockAllForTests = (): void => {
  unlocked = false;
  hydrated = false;
  listeners.clear();
};
