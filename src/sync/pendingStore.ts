import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PersistedState } from '@/state/AppState';

import { PendingSync, emptyPending, isPendingEmpty } from './types';

// AsyncStorage plumbing for the sync layer: the per-user pending queue and
// the adopt-staging blob used when the user id changes.

export const appStateKey = (userId: string): string =>
  `dmv-prep/app-state/v2/${userId}`;

const pendingKey = (userId: string): string =>
  `dmv-prep/pending-sync/v1/${userId}`;

const ADOPT_KEY = 'dmv-prep/adopt-pending/v1';

export const loadPending = async (userId: string): Promise<PendingSync> => {
  try {
    const raw = await AsyncStorage.getItem(pendingKey(userId));
    return raw != null
      ? { ...emptyPending(), ...JSON.parse(raw) }
      : emptyPending();
  } catch {
    return emptyPending();
  }
};

export const savePending = async (
  userId: string,
  pending: PendingSync,
): Promise<void> => {
  try {
    if (isPendingEmpty(pending)) {
      await AsyncStorage.removeItem(pendingKey(userId));
    } else {
      await AsyncStorage.setItem(pendingKey(userId), JSON.stringify(pending));
    }
  } catch {
    // Best-effort: an unsaved queue only risks a redundant future push.
  }
};

type AdoptBlob = { fromUserId: string; state: PersistedState };

// Snapshots the given user's persisted state so the *next* AppState hydration
// under a different user id merges it in (adopt-and-merge). Reads the blob
// straight from storage — it is written on every state change, so it is
// current without needing access to React state.
export const stageAdoptFromUser = async (fromUserId: string): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(appStateKey(fromUserId));
    if (raw == null) {
      return;
    }
    const blob: AdoptBlob = { fromUserId, state: JSON.parse(raw) };
    await AsyncStorage.setItem(ADOPT_KEY, JSON.stringify(blob));
  } catch {
    // Losing the staged snapshot only loses unsynced local-only progress.
  }
};

// Consumes the staged snapshot. Returns the state when it came from a
// different user id; a same-user snapshot (e.g. a failed sign-in attempt)
// is discarded.
export const takeAdoptState = async (
  currentUserId: string,
): Promise<PersistedState | null> => {
  try {
    const raw = await AsyncStorage.getItem(ADOPT_KEY);
    if (raw == null) {
      return null;
    }
    await AsyncStorage.removeItem(ADOPT_KEY);
    const blob: AdoptBlob = JSON.parse(raw);
    return blob.fromUserId !== currentUserId ? blob.state : null;
  } catch {
    return null;
  }
};

// First successful sign-in (anonymous or restored): hand the pre-auth 'local'
// data over to the real user id via the adopt mechanism, then drop the local
// keys so they can't be adopted twice.
export const migrateLocalDataToUser = async (
  localUserId: string,
): Promise<void> => {
  await stageAdoptFromUser(localUserId);
  try {
    await AsyncStorage.removeItem(appStateKey(localUserId));
    await AsyncStorage.removeItem(pendingKey(localUserId));
  } catch {
    // Stale local keys are harmless; adoption already snapshotted them.
  }
};
