import { create } from 'zustand';

import type { ExcerptAnchor } from '@admin/model/excerptAnchor';

// The prompt builder: excerpts picked out of lessons with a note each, copied
// out as one markdown request.
//
// Two boards, not one. A request about wording and a request about artwork are
// different jobs with different instructions, and collecting them into one list
// meant finishing the first before starting the second — or copying a prompt
// that asked for both at once. They behave identically; they simply do not see
// each other.
//
// What is collected survives the page, the browser being closed, and a redeploy
// of the panel, because it is written to localStorage on every change. The work
// of picking twenty excerpts out of a course is worth more than the page that
// was holding them, and it used to live only until a refresh.

export type PromptBoard = 'text' | 'images';

export const PROMPT_BOARDS: readonly PromptBoard[] = ['text', 'images'];

export const PROMPT_BOARD_LABEL: Record<PromptBoard, string> = {
  text: 'Text',
  images: 'Images',
};

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

export type PromptBoardState = {
  chunks: PromptChunk[];
  overallNote: string;
};

type Boards = Record<PromptBoard, PromptBoardState>;

type PromptState = {
  // Which board is being looked at and added to.
  board: PromptBoard;
  boards: Boards;
  setBoard: (board: PromptBoard) => void;
  add: (chunk: Omit<PromptChunk, 'id'>) => void;
  setNote: (id: string, note: string) => void;
  remove: (id: string) => void;
  setOverallNote: (note: string) => void;
  // The board being looked at, and only it: the other one is somebody else's
  // unfinished work as far as this button is concerned.
  clear: () => void;
};

const KEY = 'permitcoach.prompt';
// Stamped into what is written so a later shape can recognise what it is
// reading rather than guessing at it.
const SHAPE = 1;

const emptyBoards = (): Boards => ({
  text: { chunks: [], overallNote: '' },
  images: { chunks: [], overallNote: '' },
});

const isBoard = (value: unknown): value is PromptBoard =>
  typeof value === 'string' && (PROMPT_BOARDS as string[]).includes(value);

// Whatever is in storage, read defensively. A panel that throws on start
// because of a half-written key would lose the very thing this exists to keep,
// so anything unreadable is dropped field by field rather than wholesale.
const chunkOf = (value: unknown): PromptChunk | null => {
  if (value == null || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.text !== 'string' || raw.text.length === 0) {
    return null;
  }
  return {
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : makeId(),
    text: raw.text,
    source: typeof raw.source === 'string' ? raw.source : '',
    note: typeof raw.note === 'string' ? raw.note : '',
    anchor: (raw.anchor ?? null) as ExcerptAnchor | null,
  };
};

const boardOf = (value: unknown): PromptBoardState => {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    chunks: Array.isArray(raw.chunks)
      ? raw.chunks
          .map(chunkOf)
          .filter((chunk): chunk is PromptChunk => chunk != null)
      : [],
    overallNote: typeof raw.overallNote === 'string' ? raw.overallNote : '',
  };
};

type Stored = { board: PromptBoard; boards: Boards };

const load = (): Stored => {
  const fallback: Stored = { board: 'text', boards: emptyBoards() };
  try {
    const stored = localStorage.getItem(KEY);
    if (stored == null) {
      return fallback;
    }
    const raw = JSON.parse(stored) as Record<string, unknown>;
    const boards = (raw.boards ?? {}) as Record<string, unknown>;
    return {
      board: isBoard(raw.board) ? raw.board : 'text',
      boards: {
        text: boardOf(boards.text),
        images: boardOf(boards.images),
      },
    };
  } catch {
    return fallback;
  }
};

// Unique across reloads: a counter alone would start again at one and collide
// with the ids already restored from storage.
let counter = 0;
const makeId = (): string => {
  counter += 1;
  const unique = globalThis.crypto?.randomUUID?.();
  return unique ?? `chunk-${Date.now().toString(36)}-${counter}`;
};

export const usePrompt = create<PromptState>((set, get) => {
  const persisted = load();

  const persist = (): void => {
    const { board, boards } = get();
    try {
      localStorage.setItem(KEY, JSON.stringify({ shape: SHAPE, board, boards }));
    } catch {
      // A full or disabled store is not a reason to lose what is on screen;
      // the session keeps working, it simply will not outlive the page.
    }
  };

  // Every change is to one board, and every change is written through.
  const edit = (change: (board: PromptBoardState) => PromptBoardState): void => {
    set(state => ({
      boards: { ...state.boards, [state.board]: change(state.boards[state.board]) },
    }));
    persist();
  };

  return {
    board: persisted.board,
    boards: persisted.boards,

    setBoard: board => {
      set({ board });
      persist();
    },

    add: chunk =>
      edit(board => ({
        ...board,
        chunks: [...board.chunks, { ...chunk, id: makeId() }],
      })),

    setNote: (id, note) =>
      edit(board => ({
        ...board,
        chunks: board.chunks.map(chunk =>
          chunk.id === id ? { ...chunk, note } : chunk,
        ),
      })),

    remove: id =>
      edit(board => ({
        ...board,
        chunks: board.chunks.filter(chunk => chunk.id !== id),
      })),

    setOverallNote: overallNote => edit(board => ({ ...board, overallNote })),

    clear: () => edit(() => ({ chunks: [], overallNote: '' })),
  };
});

// The board on screen, which is what every consumer of one board wants.
export const useActiveBoard = (): PromptBoardState =>
  usePrompt(state => state.boards[state.board]);
