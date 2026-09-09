import { create } from 'zustand';

import { adminApi } from '@admin/api/adminApi';
import { ApiError } from '@admin/api/client';
import type {
  Channel,
  ChannelMove,
  SignImageRef,
  SignsChannels,
  SignsDoc,
} from '@admin/api/types';

// The signs catalogue's editing state. There are no drafts and no versions:
// `saved` is the working document as it sits on the server, `doc` is the
// working copy, and Save rewrites it. Publishing points a channel at a
// snapshot of it — staging first, then production — so saving alone changes
// nothing for anyone.

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

type SignsState = {
  saved: SignsDoc | null;
  doc: SignsDoc | null;
  loading: boolean;
  saving: boolean;
  uploading: boolean;
  error: string | null;
  load: () => Promise<void>;
  mutate: (mutator: (doc: SignsDoc) => void) => void;
  revert: () => void;
  save: () => Promise<string[] | null>;
  upload: (file: File) => Promise<SignImageRef | string[]>;
  channels: SignsChannels | null;
  loadChannels: () => Promise<void>;
  // Every publish, newest first — the list a rollback is picked from.
  history: ChannelMove[] | null;
  loadHistory: () => Promise<void>;
  publish: (
    channel: Channel,
    sha256?: string,
  ) => Promise<{ ok: boolean; detail: string }>;
};

// Entities that differ between the saved document and the working copy, for
// the footer. Entity-level, not field-level: one renamed sign and one
// recoloured category read as "2 changed".
export const changedEntityCount = (state: SignsState): number => {
  if (state.saved == null || state.doc == null) {
    return 0;
  }
  const count = <T extends { id: string }>(before: T[], after: T[]): number => {
    const byId = new Map(before.map(item => [item.id, JSON.stringify(item)]));
    const changed = after.filter(
      item => byId.get(item.id) !== JSON.stringify(item),
    ).length;
    const kept = new Set(after.map(item => item.id));
    return changed + before.filter(item => !kept.has(item.id)).length;
  };
  return (
    count(state.saved.categories, state.doc.categories) +
    count(state.saved.signs, state.doc.signs)
  );
};

export const useSigns = create<SignsState>((set, get) => ({
  saved: null,
  doc: null,
  loading: false,
  saving: false,
  uploading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const doc = await adminApi.signsDoc();
      set({ loading: false, saved: clone(doc), doc: clone(doc) });
    } catch (error) {
      set({
        loading: false,
        error:
          error instanceof ApiError
            ? error.message
            : 'Could not load the signs catalogue — check the server log',
      });
    }
  },

  mutate: mutator => {
    set(state => {
      if (state.doc == null) {
        return {};
      }
      const doc = clone(state.doc);
      mutator(doc);
      return { doc };
    });
  },

  // Exact, because `saved` is never mutated in place.
  revert: () => {
    set(state => (state.saved == null ? {} : { doc: clone(state.saved) }));
  },

  // Returns null on success, or the validator's error list for the screen to
  // show — a 400 is an authoring problem, not a crash.
  save: async () => {
    const doc = get().doc;
    if (doc == null) {
      return ['nothing to save'];
    }
    set({ saving: true });
    try {
      await adminApi.saveSignsDoc(doc);
      set({ saving: false, saved: clone(doc) });
      return null;
    } catch (error) {
      set({ saving: false });
      if (error instanceof ApiError && Array.isArray(error.errors)) {
        return error.errors;
      }
      return [
        error instanceof Error ? error.message : 'save failed — server log',
      ];
    }
  },

  // The server hashes the bytes and returns the reference the document must
  // carry, so the panel never invents an asset id.
  upload: async file => {
    set({ uploading: true });
    try {
      const ref = await adminApi.uploadSignAsset(file);
      set({ uploading: false });
      return ref;
    } catch (error) {
      set({ uploading: false });
      if (error instanceof ApiError && Array.isArray(error.errors)) {
        return error.errors;
      }
      return [
        error instanceof Error ? error.message : 'upload failed — server log',
      ];
    }
  },

  channels: null,
  history: null,

  loadChannels: async () => {
    try {
      set({ channels: await adminApi.signsChannels() });
    } catch {
      set({ channels: null });
    }
  },

  loadHistory: async () => {
    try {
      set({ history: (await adminApi.signsHistory(20)).moves });
    } catch {
      set({ history: [] });
    }
  },

  publish: async (channel, sha256) => {
    try {
      const move = await adminApi.publishSigns(channel, sha256);
      await Promise.all([get().loadChannels(), get().loadHistory()]);
      const where = channel === 'production' ? 'Production' : 'Staging';
      return {
        ok: true,
        detail:
          move.from === move.to
            ? `${where} already served this catalogue`
            : `${where} now serves ${move.to.slice(0, 12)}`,
      };
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : 'publish failed',
      };
    }
  },
}));
