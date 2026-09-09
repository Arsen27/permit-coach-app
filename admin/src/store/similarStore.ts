import { create } from 'zustand';

import { api } from '@admin/api/client';

// Results of a similarity search against the reference course.

export type SimilarResult = {
  lessonId: string;
  lessonTitle: string;
  cardIndex: number;
  cardType: string;
  snippet: string;
  score: number;
  reason?: string;
};

export type SimilarTarget =
  | { kind: 'released'; courseId: string; version: string }
  | { kind: 'draft'; courseId: string; draftId: string }
  | { kind: 'competitor'; competitorId: string };

type SimilarState = {
  status: 'idle' | 'searching' | 'done' | 'error';
  query: string;
  results: SimilarResult[];
  source: 'llm' | 'local' | null;
  model: string;
  note: string | null;
  error: string | null;
  run: (query: string, target: SimilarTarget) => Promise<void>;
  clear: () => void;
};

export const useSimilar = create<SimilarState>(set => ({
  status: 'idle',
  query: '',
  results: [],
  source: null,
  model: '',
  note: null,
  error: null,

  run: async (query, target) => {
    set({ status: 'searching', query, results: [], error: null, note: null });
    try {
      const response = await api.post<{
        results: SimilarResult[];
        provider: string;
        model: string;
        source: 'llm' | 'local';
        note?: string;
      }>('/similar', { query, target });
      set({
        status: 'done',
        results: response.results,
        source: response.source,
        model: response.model,
        note: response.note ?? null,
      });
    } catch (error) {
      set({ status: 'error', error: (error as Error).message });
    }
  },

  clear: () =>
    set({ status: 'idle', query: '', results: [], note: null, error: null }),
}));
