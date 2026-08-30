import { useEffect, useSyncExternalStore } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

// Which content channel this device downloads from. Production is what every
// install sees; staging is where a release waits to be looked at before it
// goes to everyone.
//
// Dev-only, and hard-disabled in release builds: `getContentChannel()` returns
// 'production' unless __DEV__, so a stored 'staging' from a dev build on the
// same device cannot leak into production behaviour. The staging key is the
// server's door — without it the channel answers as if it did not exist.
// Device-local, never synced.

export type ContentChannel = 'production' | 'staging';

const CHANNEL_KEY = 'dmv-prep/dev-content-channel/v1';
const STAGING_KEY = 'dmv-prep/dev-staging-key/v1';

let channel: ContentChannel = 'production';
let stagingKey = '';
let hydration: Promise<void> | null = null;
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach(listener => listener());
};

export const getContentChannel = (): ContentChannel =>
  __DEV__ ? channel : 'production';

export const getStagingKey = (): string => (__DEV__ ? stagingKey : '');

// Restores both once per launch. Callers get the *same* promise, so awaiting
// it means the channel is known — a second caller used to return immediately
// while the first read was still in flight, and whoever asked next was told
// 'production' whatever the device had stored.
export const hydrateContentChannel = (): Promise<void> => {
  if (!__DEV__) {
    return Promise.resolve();
  }
  hydration ??= (async () => {
    try {
      const [storedChannel, storedKey] = await AsyncStorage.getMany([
        CHANNEL_KEY,
        STAGING_KEY,
      ]).then(entries => [entries[CHANNEL_KEY], entries[STAGING_KEY]]);
      if (storedChannel === 'staging') {
        channel = 'staging';
      }
      if (typeof storedKey === 'string') {
        stagingKey = storedKey;
      }
      notify();
    } catch {
      // Unreadable store — stay on production, which is the release behaviour.
    }
  })();
  return hydration;
};

export const setStagingKey = (next: string): void => {
  if (!__DEV__ || stagingKey === next) {
    return;
  }
  stagingKey = next;
  notify();
  AsyncStorage.setItem(STAGING_KEY, next).catch(() => undefined);
};

// Switching channels is a different course, not a newer one: what the device
// holds was downloaded from somewhere else and must go. The caller downloads
// the new channel's course afterwards, which is why this returns rather than
// doing it — the progress belongs on screen.
export const setContentChannel = async (
  next: ContentChannel,
  wipe: () => Promise<void>,
): Promise<void> => {
  if (!__DEV__ || channel === next) {
    return;
  }
  channel = next;
  await AsyncStorage.setItem(CHANNEL_KEY, next).catch(() => undefined);
  await wipe();
  notify();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// Self-hydrating: the first consumer to mount restores the stored values.
export const useContentChannel = (): ContentChannel => {
  useEffect(() => {
    hydrateContentChannel();
  }, []);

  return useSyncExternalStore(subscribe, getContentChannel);
};

export const useStagingKey = (): string => {
  useEffect(() => {
    hydrateContentChannel();
  }, []);

  return useSyncExternalStore(subscribe, getStagingKey);
};

// Test seam.
export const resetContentChannelForTests = (): void => {
  channel = 'production';
  stagingKey = '';
  hydration = null;
  listeners.clear();
};
