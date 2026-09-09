import { create } from 'zustand';

// What the viewer is showing. The left pane is primary: it follows the
// sidebars. The right pane is the reference and is chosen through its own
// picker, either mirroring the left lesson (sync) or holding its own.

export type ViewMode = 'text' | 'phone';

type SelectionState = {
  selectedKey: string | null;
  lessonId: string | null;
  compareKey: string | null;
  compareOn: boolean;
  refLessonId: string | null;
  syncOn: boolean;
  refPick: boolean;
  diffOn: boolean;
  mode: ViewMode;
  phoneIndexA: number;
  phoneIndexB: number;

  selectVersion: (key: string, fallbackLessonId?: string | null) => void;
  selectLesson: (lessonId: string) => void;
  setCompare: (key: string | null, options?: { sync?: boolean }) => void;
  toggleCompare: () => void;
  setMode: (mode: ViewMode) => void;
  toggleDiff: () => void;
  toggleSync: () => void;
  toggleRefPick: () => void;
  pickReferenceLesson: (lessonId: string, cardIndex?: number) => void;
  setPhoneIndexA: (index: number) => void;
  setPhoneIndexB: (index: number) => void;
  remapCourse: (params: {
    versionKey: string;
    lessonId: string | null;
    compareKey: string | null;
  }) => void;
};

export const useSelection = create<SelectionState>(set => ({
  selectedKey: null,
  lessonId: null,
  compareKey: null,
  compareOn: false,
  refLessonId: null,
  syncOn: true,
  refPick: false,
  diffOn: true,
  mode: 'text',
  phoneIndexA: 0,
  phoneIndexB: 0,

  selectVersion: (key, fallbackLessonId) =>
    set(state => ({
      selectedKey: key,
      lessonId: fallbackLessonId ?? state.lessonId,
      phoneIndexA: 0,
    })),

  selectLesson: lessonId =>
    set(state =>
      // While picking a reference, a sidebar click chooses the right pane's
      // lesson instead of moving the left one.
      state.refPick
        ? {
            refLessonId: lessonId,
            refPick: false,
            syncOn: false,
            phoneIndexB: 0,
          }
        : { lessonId, phoneIndexA: 0 },
    ),

  setCompare: (key, options) =>
    set(state => ({
      compareKey: key,
      compareOn: key != null,
      phoneIndexB: 0,
      // Lesson ids never line up across different courses, so a reference that
      // cannot be synced starts unsynced with its own lesson.
      syncOn: options?.sync ?? state.syncOn,
      refLessonId: options?.sync === false ? null : state.refLessonId,
    })),

  toggleCompare: () =>
    set(state => ({ compareOn: !state.compareOn, refPick: false })),

  setMode: mode => set({ mode }),
  toggleDiff: () => set(state => ({ diffOn: !state.diffOn })),
  toggleSync: () =>
    set(state => ({ syncOn: !state.syncOn, refPick: false, phoneIndexB: 0 })),
  toggleRefPick: () =>
    set(state => ({ refPick: !state.refPick, syncOn: false })),

  pickReferenceLesson: (lessonId, cardIndex = 0) =>
    set({
      refLessonId: lessonId,
      syncOn: false,
      refPick: false,
      phoneIndexB: cardIndex,
    }),

  setPhoneIndexA: index => set({ phoneIndexA: Math.max(0, index) }),
  setPhoneIndexB: index => set({ phoneIndexB: Math.max(0, index) }),

  // Switching state swaps the whole course tree. The place — module, lesson
  // number, view mode, card index — carries over; only the identifiers change.
  remapCourse: ({ versionKey, lessonId, compareKey }) =>
    set(state => ({
      selectedKey: versionKey,
      lessonId: lessonId ?? state.lessonId,
      compareKey,
      compareOn: state.compareOn && compareKey != null,
      refLessonId: null,
      refPick: false,
    })),
}));

// The lesson the right pane shows: the left one while synced, its own otherwise.
export const referenceLessonId = (state: SelectionState): string | null =>
  state.syncOn ? state.lessonId : state.refLessonId ?? state.lessonId;
