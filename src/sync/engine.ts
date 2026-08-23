import { AppState as RNAppState, NativeEventSubscription } from 'react-native';

import { createLogger } from '@/lib/log';
import { supabase } from '@/lib/supabase';
import type { PersistedState } from '@/state/AppState';

import { buildPushPayload, mergeRemoteIntoLocal } from './merge';
import { loadPending, savePending } from './pendingStore';
import {
  DirtyMark,
  LOCAL_USER_ID,
  PendingSync,
  RemoteSnapshot,
  emptyPending,
  isPendingEmpty,
  markPending,
  mergePending,
  subtractPending,
} from './types';

const PUSH_DEBOUNCE_MS = 2500;
const PULL_THROTTLE_MS = 60_000;
const RETRY_BASE_MS = 30_000;
const RETRY_MAX_MS = 300_000;

const log = createLogger('sync');

type SyncEngineDeps = {
  userId: string;
  getState: () => PersistedState;
  applyRemote: (updater: (prev: PersistedState) => PersistedState) => void;
};

// One instance per (mounted AppStateProvider, user). Owns the pending queue:
// debounced push of dirty entities, pull-and-merge on start and foreground,
// flush on backgrounding. All failures degrade to "try again later" — the
// local state is always the source of truth for rendering.
export class SyncEngine {
  private deps: SyncEngineDeps;
  private pending: PendingSync = emptyPending();
  private loaded = false;
  private stopped = false;
  private pushing = false;
  private lastPullAt = 0;
  private retryDelay = RETRY_BASE_MS;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private appStateSub: NativeEventSubscription | null = null;

  constructor(deps: SyncEngineDeps) {
    this.deps = deps;
  }

  start = async (): Promise<void> => {
    this.appStateSub = RNAppState.addEventListener(
      'change',
      this.onAppStateChange,
    );
    // Merge, don't replace: marks can arrive while the stored queue loads.
    this.pending = mergePending(
      await loadPending(this.deps.userId),
      this.pending,
    );
    this.loaded = true;
    if (this.stopped || !this.canSync()) {
      return;
    }
    this.pull();
    if (!isPendingEmpty(this.pending)) {
      this.schedulePush();
    }
  };

  stop = (): void => {
    this.stopped = true;
    this.appStateSub?.remove();
    this.appStateSub = null;
    if (this.pushTimer != null) {
      clearTimeout(this.pushTimer);
    }
    if (this.retryTimer != null) {
      clearTimeout(this.retryTimer);
    }
  };

  markDirty = (mark: DirtyMark): void => {
    log.info(`dirty: ${mark.kind}`, mark);
    this.pending = markPending(this.pending, mark);
    savePending(this.deps.userId, this.pending);
    this.schedulePush();
  };

  private canSync = (): boolean =>
    supabase != null && this.deps.userId !== LOCAL_USER_ID;

  private onAppStateChange = (status: string): void => {
    if (status === 'active') {
      if (Date.now() - this.lastPullAt >= PULL_THROTTLE_MS) {
        this.pull();
      }
      if (!isPendingEmpty(this.pending)) {
        this.flush();
      }
    } else if (status === 'background') {
      this.flush();
    }
  };

  private schedulePush = (): void => {
    if (!this.canSync() || this.stopped) {
      return;
    }
    if (this.pushTimer != null) {
      clearTimeout(this.pushTimer);
    }
    this.pushTimer = setTimeout(() => this.flush(), PUSH_DEBOUNCE_MS);
  };

  private scheduleRetry = (): void => {
    if (this.stopped) {
      return;
    }
    if (this.retryTimer != null) {
      clearTimeout(this.retryTimer);
    }
    this.retryTimer = setTimeout(() => this.flush(), this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, RETRY_MAX_MS);
  };

  flush = async (): Promise<void> => {
    if (
      !this.canSync() ||
      !this.loaded ||
      this.pushing ||
      this.stopped ||
      isPendingEmpty(this.pending)
    ) {
      return;
    }
    this.pushing = true;
    const snapshot = this.pending;
    const payload = buildPushPayload(this.deps.getState(), snapshot);
    const elapsed = log.time();
    log.info(
      `push → lessons=${payload.lessons.length} topics=${payload.topics.length} ` +
        `questionStats=${payload.question_stats.length} ` +
        `resets=${payload.reset_ops.length} sets=${payload.set_ops.length}`,
      payload,
    );
    const { error } = await supabase!.rpc('sync_push', { payload });
    this.pushing = false;
    if (this.stopped) {
      return;
    }
    if (error) {
      log.warn(`push failed (${elapsed()}ms) — retrying`, error.message);
      this.scheduleRetry();
      return;
    }
    log.info(`push ok (${elapsed()}ms)`);
    this.retryDelay = RETRY_BASE_MS;
    // Marks that arrived while the push was in flight stay queued.
    this.pending = subtractPending(this.pending, snapshot);
    savePending(this.deps.userId, this.pending);
    if (!isPendingEmpty(this.pending)) {
      this.schedulePush();
    }
  };

  pull = async (): Promise<void> => {
    if (!this.canSync() || !this.loaded || this.stopped) {
      return;
    }
    const elapsed = log.time();
    const { data, error } = await supabase!.rpc('sync_pull');
    if (error || data == null || this.stopped) {
      if (error) {
        log.warn(`pull failed (${elapsed()}ms)`, error.message);
      }
      return;
    }
    this.lastPullAt = Date.now();
    const snapshot = data as RemoteSnapshot;
    // Supabase is the source of truth: rows absent here are dropped locally
    // unless they carry an unpushed change.
    log.info(
      `pull ← lessons=${snapshot.lessons.length} topics=${snapshot.topics.length} ` +
        `questionStats=${snapshot.question_stats?.length ?? 'n/a'} ` +
        `saved=${snapshot.saved.length} mistakes=${
          snapshot.mistakes.length
        } (${elapsed()}ms)`,
      snapshot,
    );
    // Read the queue when the updater actually runs, not when the pull
    // resolved — a reset marked in between must not be resurrected by this
    // merge.
    this.deps.applyRemote(prev =>
      mergeRemoteIntoLocal(prev, snapshot, this.pending),
    );
  };
}
