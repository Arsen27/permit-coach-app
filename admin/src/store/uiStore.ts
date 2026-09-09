import { create } from 'zustand';

// Panel geometry, transient chrome and anything else that is about the shell
// rather than the content. Collapse states and the phone scale survive a
// reload — they are workstation preferences, not session state.

export type Screen = 'course' | 'questions' | 'signs' | 'formats' | 'settings';

// The header's two halves of the content model: one state's course, which is
// what every screen below edits, and the universal skeleton every state's
// course is built from. The skeleton is one document, not per state, so it has
// no course, no version and no channel — the header hides those while it is
// open.
export type Tab = 'state' | 'skeleton';
export type RightDock = 'prompt' | 'similar' | null;

export type ModalState =
  | { kind: 'save-as' }
  | { kind: 'duplicate' }
  | { kind: 'release' }
  | { kind: 'publish'; version: string }
  | { kind: 'slide-types' }
  | null;

export type ContextMenuState = {
  x: number;
  y: number;
  text: string;
} | null;

type Persisted = {
  versionsOpen: boolean;
  lessonsOpen: boolean;
  rightDock: RightDock;
  phoneScale: number;
};

const KEY = 'permitcoach.ui';

const loadPersisted = (): Persisted => {
  const fallback: Persisted = {
    versionsOpen: true,
    lessonsOpen: true,
    rightDock: null,
    phoneScale: 0.62,
  };
  try {
    const stored = localStorage.getItem(KEY);
    return stored == null
      ? fallback
      : { ...fallback, ...(JSON.parse(stored) as Partial<Persisted>) };
  } catch {
    return fallback;
  }
};

type UiState = Persisted & {
  screen: Screen;
  tab: Tab;
  modal: ModalState;
  contextMenu: ContextMenuState;
  toast: string;
  setScreen: (screen: Screen) => void;
  setTab: (tab: Tab) => void;
  toggleVersions: () => void;
  toggleLessons: () => void;
  setRightDock: (dock: RightDock) => void;
  toggleRightDock: (dock: Exclude<RightDock, null>) => void;
  setPhoneScale: (scale: number) => void;
  openModal: (modal: ModalState) => void;
  closeModal: () => void;
  openContextMenu: (menu: ContextMenuState) => void;
  closeContextMenu: () => void;
  showToast: (message: string) => void;
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUi = create<UiState>((set, get) => {
  const persisted = loadPersisted();

  const persist = () => {
    const { versionsOpen, lessonsOpen, rightDock, phoneScale } = get();
    localStorage.setItem(
      KEY,
      JSON.stringify({ versionsOpen, lessonsOpen, rightDock, phoneScale }),
    );
  };

  return {
    ...persisted,
    screen: 'course',
    tab: 'state',
    modal: null,
    contextMenu: null,
    toast: '',

    setScreen: screen => set({ screen }),
    setTab: tab => set({ tab }),
    toggleVersions: () => {
      set(state => ({ versionsOpen: !state.versionsOpen }));
      persist();
    },
    toggleLessons: () => {
      set(state => ({ lessonsOpen: !state.lessonsOpen }));
      persist();
    },
    setRightDock: dock => {
      set({ rightDock: dock });
      persist();
    },
    toggleRightDock: dock => {
      set(state => ({ rightDock: state.rightDock === dock ? null : dock }));
      persist();
    },
    setPhoneScale: scale => {
      set({ phoneScale: scale });
      persist();
    },

    openModal: modal => set({ modal }),
    closeModal: () => set({ modal: null }),
    openContextMenu: menu => set({ contextMenu: menu }),
    closeContextMenu: () => set({ contextMenu: null }),

    showToast: message => {
      set({ toast: message });
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => set({ toast: '' }), 2800);
    },
  };
});
