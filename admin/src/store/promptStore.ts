import { create } from 'zustand';

import type { ExcerptAnchor } from '@admin/model/excerptAnchor';

// The prompt builder: excerpts picked out of lessons with a note each, copied
// out as one markdown request.

export type PromptChunk = {
  id: string;
  text: string;
  source: string;
  note: string;
  // The card and lines the excerpt was taken from. A quote alone is ambiguous
  // — the same sentence lives in more than one slide — so the request names a
  // place instead of asking a model to search for one.
  anchor?: ExcerptAnchor | null;
};

type PromptState = {
  chunks: PromptChunk[];
  overallNote: string;
  add: (chunk: Omit<PromptChunk, 'id'>) => void;
  setNote: (id: string, note: string) => void;
  remove: (id: string) => void;
  setOverallNote: (note: string) => void;
  clear: () => void;
};

let nextId = 0;

export const usePrompt = create<PromptState>(set => ({
  chunks: [],
  overallNote: '',

  add: chunk =>
    set(state => ({
      chunks: [...state.chunks, { ...chunk, id: `chunk-${(nextId += 1)}` }],
    })),

  setNote: (id, note) =>
    set(state => ({
      chunks: state.chunks.map(chunk =>
        chunk.id === id ? { ...chunk, note } : chunk,
      ),
    })),

  remove: id =>
    set(state => ({ chunks: state.chunks.filter(chunk => chunk.id !== id) })),

  setOverallNote: overallNote => set({ overallNote }),

  clear: () => set({ chunks: [], overallNote: '' }),
}));
