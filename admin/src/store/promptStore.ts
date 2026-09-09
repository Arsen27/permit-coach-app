import { create } from 'zustand';

// The prompt builder: excerpts picked out of lessons with a note each, copied
// out as one markdown request.

export type PromptChunk = {
  id: string;
  text: string;
  source: string;
  note: string;
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
