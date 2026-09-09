import { create } from 'zustand';

import { adminApi } from '@admin/api/adminApi';
import { ApiError } from '@admin/api/client';
import type {
  AuthoringRevision,
  AuthoringStatus,
  CardPatch,
  ParameterCatalogue,
  QuestionPatch,
  SkeletonView,
  StateParamValue,
} from '@admin/api/types';

// The Skeleton tab's data.
//
// One document shared by every state, so there is nothing per-course to reload
// and no version to pick — but there is now something to save. Every write goes
// to exactly one of three places, and the store keeps that distinction visible
// rather than deciding it: `saveCard` without a state edits what is shared,
// `saveCard` with one edits that state's own copy.

type SkeletonState = {
  view: SkeletonView | null;
  parameters: ParameterCatalogue | null;
  status: AuthoringStatus | null;
  revisions: AuthoringRevision[];
  loading: boolean;
  error: string | null;
  // What the server refused, line by line — the builder's own complaints.
  refusal: string[] | null;
  lessonId: string | null;
  // A revision held beside the working document, for the diff.
  compare: { revision: number; view: SkeletonView } | null;
  saving: boolean;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  selectLesson: (lessonId: string | null) => void;
  clearRefusal: () => void;
  saveCard: (
    anchor: string,
    patch: CardPatch,
    stateCode?: string,
  ) => Promise<boolean>;
  saveQuestion: (
    questionId: string,
    patch: QuestionPatch,
    stateCode?: string,
  ) => Promise<boolean>;
  saveParam: (
    stateCode: string,
    key: string,
    param: StateParamValue,
  ) => Promise<boolean>;
  revert: (stateCode: string, anchor: string) => Promise<boolean>;
  promote: (
    stateCode: string,
    kind: 'card' | 'question',
    target: string,
  ) => Promise<boolean>;
  cutRevision: (message: string) => Promise<boolean>;
  loadRevisions: () => Promise<void>;
  compareRevision: (revision: number | null) => Promise<void>;
};

const SUBJECT = 'skeleton';

export const useSkeleton = create<SkeletonState>((set, get) => {
  // Every write ends the same way: the refusal is shown, or the view is
  // refreshed so the screen shows what was actually stored rather than what
  // was typed.
  const attempt = async (run: () => Promise<unknown>): Promise<boolean> => {
    set({ saving: true, refusal: null });
    try {
      await run();
      await get().refresh();
      set({ saving: false });
      return true;
    } catch (error) {
      const failure = error as ApiError;
      set({
        saving: false,
        refusal:
          failure.errors != null && failure.errors.length > 0
            ? [failure.message, ...failure.errors]
            : [failure.message],
      });
      return false;
    }
  };

  return {
    view: null,
    parameters: null,
    status: null,
    revisions: [],
    loading: false,
    error: null,
    refusal: null,
    lessonId: null,
    compare: null,
    saving: false,

    load: async () => {
      if (get().loading || get().view != null) {
        return;
      }
      set({ loading: true, error: null });
      try {
        const [view, parameters, status] = await Promise.all([
          adminApi.skeleton(),
          adminApi.skeletonParameters(),
          adminApi.skeletonStatus(),
        ]);
        const first = view.modules.flatMap(module => module.lessons)[0] ?? null;
        set({
          view,
          parameters,
          status,
          loading: false,
          lessonId: get().lessonId ?? first?.id ?? null,
        });
        void get().loadRevisions();
      } catch (error) {
        set({ loading: false, error: (error as Error).message });
      }
    },

    refresh: async () => {
      const [view, parameters, status] = await Promise.all([
        adminApi.skeleton(),
        adminApi.skeletonParameters(),
        adminApi.skeletonStatus(),
      ]);
      set({ view, parameters, status });
    },

    selectLesson: lessonId => set({ lessonId }),
    clearRefusal: () => set({ refusal: null }),

    saveCard: (anchor, patch, stateCode) =>
      attempt(() =>
        stateCode == null
          ? adminApi.saveSkeletonCard(anchor, patch)
          : adminApi.saveStateCard(stateCode, anchor, patch),
      ),

    saveQuestion: (questionId, patch, stateCode) =>
      attempt(() =>
        stateCode == null
          ? adminApi.saveSkeletonQuestion(questionId, patch)
          : adminApi.saveStateQuestion(stateCode, questionId, patch),
      ),

    saveParam: (stateCode, key, param) =>
      attempt(() => adminApi.saveStateParam(stateCode, key, param)),

    revert: (stateCode, anchor) =>
      attempt(() => adminApi.revertStateCard(stateCode, anchor)),

    promote: (stateCode, kind, target) =>
      attempt(() => adminApi.promoteToSkeleton(stateCode, kind, target)),

    cutRevision: async message => {
      const ok = await attempt(() =>
        adminApi.cutSkeletonRevision(SUBJECT, message),
      );
      if (ok) {
        await get().loadRevisions();
      }
      return ok;
    },

    loadRevisions: async () => {
      const { revisions } = await adminApi.skeletonRevisions(SUBJECT);
      set({ revisions });
    },

    compareRevision: async revision => {
      if (revision == null) {
        set({ compare: null });
        return;
      }
      set({
        compare: {
          revision,
          view: await adminApi.skeletonRevision(SUBJECT, revision),
        },
      });
    },
  };
});

// Every parameter, by key, for the chips that stand in for a placeholder.
// Takes the catalogue rather than the store, because it builds a new Map: as a
// selector it would hand back a different object on every render.
export const parameterIndex = (
  catalogue: ParameterCatalogue | null,
): Map<string, ParameterCatalogue['parameters'][number]> =>
  new Map((catalogue?.parameters ?? []).map(entry => [entry.key, entry]));
