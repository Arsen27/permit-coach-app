import { create } from 'zustand';

import { adminApi } from '@admin/api/adminApi';
import type { ParameterCatalogue, SkeletonView } from '@admin/api/types';

// The skeleton tab's data. One fetch each, held for the session: the skeleton
// is a single document that only changes when someone regenerates it, so there
// is nothing per-course to reload and nothing to invalidate on a save — this
// view never writes.

type SkeletonState = {
  view: SkeletonView | null;
  parameters: ParameterCatalogue | null;
  loading: boolean;
  error: string | null;
  lessonId: string | null;
  load: () => Promise<void>;
  selectLesson: (lessonId: string | null) => void;
};

export const useSkeleton = create<SkeletonState>((set, get) => ({
  view: null,
  parameters: null,
  loading: false,
  error: null,
  lessonId: null,

  load: async () => {
    if (get().loading || get().view != null) {
      return;
    }
    set({ loading: true, error: null });
    try {
      const [view, parameters] = await Promise.all([
        adminApi.skeleton(),
        adminApi.skeletonParameters(),
      ]);
      const first = view.modules.flatMap(module => module.lessons)[0] ?? null;
      set({
        view,
        parameters,
        loading: false,
        lessonId: get().lessonId ?? first?.id ?? null,
      });
    } catch (error) {
      set({ loading: false, error: (error as Error).message });
    }
  },

  selectLesson: lessonId => set({ lessonId }),
}));

// Every parameter, by key, for the chips that stand in for a placeholder.
// Takes the catalogue rather than the store, because it builds a new Map: as a
// selector it would hand back a different object on every render.
export const parameterIndex = (
  catalogue: ParameterCatalogue | null,
): Map<string, ParameterCatalogue['parameters'][number]> =>
  new Map((catalogue?.parameters ?? []).map(entry => [entry.key, entry]));
