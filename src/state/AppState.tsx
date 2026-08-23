import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { courseIdForState } from '@/data/course';
import { courseStore } from '@/data/course/store';
import { SyncEngine } from '@/sync/engine';
import { mergeLocalStates, pendingForFullState } from '@/sync/merge';
import { appStateKey, savePending, takeAdoptState } from '@/sync/pendingStore';
import { DirtyMark } from '@/sync/types';
import {
  AccentId,
  DEFAULT_ACCENT_ID,
  FontId,
  normalizeAccentId,
} from '@/theme';

import { QuestionStats, recordAnswer } from './questionStats';
import { StreakState, bumpStreak, localToday, normalizeStreak } from './streak';

export type Plan = 'free' | 'plus';

export type UserState = {
  name: string;
  stateCode: string;
  plan: Plan;
};

export type LessonScore = {
  answered: number;
  correct: number;
  points: number;
  completed: boolean;
};

export type PersistedState = {
  user: UserState;
  streak: StreakState;
  lessonScores: Record<string, LessonScore>;
  topicScores: Record<string, number>;
  bestExam: number | null;
  // Per-question answer history behind the Practice bank map. Device-local:
  // the sync schema has no row for it, so it is never pushed.
  questionStats: QuestionStats;
  savedQuestionIds: string[];
  mistakeIds: string[];
  savedSignIds: string[];
  accentId: AccentId;
  fontId: FontId;
};

export const initialState: PersistedState = {
  user: {
    name: '',
    stateCode: 'CA',
    plan: 'free',
  },
  streak: {
    currentStreak: 0,
    lastActiveDate: null,
    longestStreak: 0,
    daysStudied: 0,
  },
  lessonScores: {},
  topicScores: {},
  bestExam: null,
  questionStats: {},
  savedQuestionIds: [],
  mistakeIds: [],
  savedSignIds: [],
  accentId: DEFAULT_ACCENT_ID,
  fontId: 'jakarta',
};

export type LessonResult = {
  lessonId: string;
  answered: number;
  correct: number;
  points: number;
  completed: boolean;
};

type AppStateValue = PersistedState & {
  // The account this state belongs to — screens that persist their own
  // per-user scratch state (e.g. where the learner stopped inside a lesson)
  // scope their storage keys by it.
  userId: string;
  points: number;
  lessonsDone: number;
  applyLessonResult: (result: LessonResult) => void;
  applyTopicResult: (topicId: string, percent: number) => void;
  applyExamResult: (percent: number) => void;
  setName: (name: string) => void;
  resetLessons: (lessonIds: string[]) => void;
  resetTopics: (topicIds: string[]) => void;
  toggleSavedQuestion: (questionId: string) => void;
  toggleSavedSign: (signId: string) => void;
  recordQuestionAnswer: (questionId: string, correct: boolean) => void;
  recordMistake: (questionId: string) => void;
  clearMistake: (questionId: string) => void;
  setStateCode: (stateCode: string) => void;
  changeStateWipingProgress: (stateCode: string) => void;
  setAccent: (accentId: AccentId) => void;
  setFont: (fontId: FontId) => void;
  upgrade: () => void;
};

// Pre-account demo builds persisted under this key; nobody real ever used it.
const LEGACY_V1_KEY = 'dmv-prep/app-state/v1';

const AppStateContext = createContext<AppStateValue | null>(null);

const toggleId = (ids: string[], id: string): string[] =>
  ids.includes(id) ? ids.filter(existing => existing !== id) : [...ids, id];

// A snapshot written by an older build is missing whatever fields have been
// added since (question stats, the lifetime streak stats). Every reader below
// assumes they exist, so fill them in at the storage boundary.
const fillMissingFields = (stored: Partial<PersistedState>): PersistedState => {
  const merged = { ...initialState, ...stored };
  return {
    ...merged,
    streak: normalizeStreak(merged.streak),
    // The snapshot may name an accent this build no longer ships.
    accentId: normalizeAccentId(merged.accentId),
  };
};

type AppStateProviderProps = {
  // Supabase user id (or the pre-auth local sentinel). The provider is keyed
  // on it in App.tsx, so a user switch remounts with a fresh hydration.
  userId: string;
  children: React.ReactNode;
};

export const AppStateProvider: React.FC<AppStateProviderProps> = ({
  userId,
  children,
}) => {
  const [state, setState] = useState(initialState);
  const [hydrated, setHydrated] = useState(false);
  const skipPersist = useRef(true);
  const stateRef = useRef(state);
  stateRef.current = state;
  const engineRef = useRef<SyncEngine | null>(null);

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      await AsyncStorage.removeItem(LEGACY_V1_KEY).catch(() => undefined);
      let next = initialState;
      try {
        const raw = await AsyncStorage.getItem(appStateKey(userId));
        if (raw != null) {
          next = fillMissingFields(JSON.parse(raw));
        }
      } catch {
        // Fall through to the zero state.
      }
      // Progress staged by an account switch (adopt-and-merge): union it in
      // and queue a full re-push — the server merge is monotonic, so this is
      // always safe.
      const adopted = await takeAdoptState(userId);
      if (adopted != null) {
        // The blob may predate the running app version, so it gets the same
        // fill-in as a stored snapshot before anything reads its fields.
        next = mergeLocalStates(next, fillMissingFields(adopted));
        await savePending(userId, pendingForFullState(next));
      }
      if (active) {
        courseStore.setActiveCourse(courseIdForState(next.user.stateCode));
        setState(next);
        setHydrated(true);
      }
    };
    hydrate();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    // The first post-hydration render carries the loaded state itself.
    if (!hydrated || skipPersist.current) {
      skipPersist.current = !hydrated;
      return;
    }
    AsyncStorage.setItem(appStateKey(userId), JSON.stringify(state)).catch(
      () => undefined,
    );
  }, [state, hydrated, userId]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const engine = new SyncEngine({
      userId,
      getState: () => stateRef.current,
      applyRemote: updater => setState(prev => updater(prev)),
    });
    engineRef.current = engine;
    engine.start();
    return () => {
      engineRef.current = null;
      engine.stop();
    };
  }, [hydrated, userId]);

  // The single seam every mutator goes through: apply the change, then tell
  // the sync engine which entities became dirty.
  const update = useCallback(
    (
      updater: (prev: PersistedState) => PersistedState,
      ...marks: DirtyMark[]
    ) => {
      setState(updater);
      marks.forEach(mark => engineRef.current?.markDirty(mark));
    },
    [],
  );

  const touchStreak = useCallback(
    (prev: PersistedState): PersistedState => ({
      ...prev,
      streak: bumpStreak(prev.streak, localToday()),
    }),
    [],
  );

  const applyLessonResult = useCallback(
    (result: LessonResult) => {
      update(
        prev => {
          const existing = prev.lessonScores[result.lessonId];
          return {
            ...touchStreak(prev),
            lessonScores: {
              ...prev.lessonScores,
              [result.lessonId]: {
                answered: result.answered,
                correct: result.correct,
                points: Math.max(existing?.points ?? 0, result.points),
                completed: (existing?.completed ?? false) || result.completed,
              },
            },
          };
        },
        { kind: 'lesson', lessonId: result.lessonId },
        { kind: 'streak' },
      );
    },
    [update, touchStreak],
  );

  const applyTopicResult = useCallback(
    (topicId: string, percent: number) => {
      update(
        prev => ({
          ...touchStreak(prev),
          topicScores: {
            ...prev.topicScores,
            [topicId]: Math.max(prev.topicScores[topicId] ?? 0, percent),
          },
        }),
        { kind: 'topic', topicId },
        { kind: 'streak' },
      );
    },
    [update, touchStreak],
  );

  const applyExamResult = useCallback(
    (percent: number) => {
      update(
        prev => ({
          ...touchStreak(prev),
          bestExam: Math.max(prev.bestExam ?? 0, percent),
        }),
        { kind: 'exam' },
        { kind: 'streak' },
      );
    },
    [update, touchStreak],
  );

  // Course-update invalidations. Reset marks are emitted for every requested
  // id, even ids with no local row — the server may still hold one, and
  // deleting a non-existent row is a free no-op.
  const resetLessons = useCallback(
    (lessonIds: string[]) => {
      if (lessonIds.length === 0) {
        return;
      }
      update(prev => {
        const lessonScores = { ...prev.lessonScores };
        lessonIds.forEach(id => delete lessonScores[id]);
        return { ...prev, lessonScores };
      }, ...lessonIds.map((id): DirtyMark => ({ kind: 'reset', type: 'lesson', id })));
    },
    [update],
  );

  const resetTopics = useCallback(
    (topicIds: string[]) => {
      if (topicIds.length === 0) {
        return;
      }
      update(prev => {
        const topicScores = { ...prev.topicScores };
        topicIds.forEach(id => delete topicScores[id]);
        return { ...prev, topicScores };
      }, ...topicIds.map((id): DirtyMark => ({ kind: 'reset', type: 'topic', id })));
    },
    [update],
  );

  const toggleSavedQuestion = useCallback(
    (questionId: string) => {
      const adds = !stateRef.current.savedQuestionIds.includes(questionId);
      update(
        prev => ({
          ...prev,
          savedQuestionIds: toggleId(prev.savedQuestionIds, questionId),
        }),
        {
          kind: 'set',
          type: 'question',
          id: questionId,
          op: adds ? 'add' : 'remove',
        },
      );
    },
    [update],
  );

  const toggleSavedSign = useCallback(
    (signId: string) => {
      const adds = !stateRef.current.savedSignIds.includes(signId);
      update(
        prev => ({
          ...prev,
          savedSignIds: toggleId(prev.savedSignIds, signId),
        }),
        { kind: 'set', type: 'sign', id: signId, op: adds ? 'add' : 'remove' },
      );
    },
    [update],
  );

  // Every graded answer goes through here, whatever the session type.
  const recordQuestionAnswer = useCallback(
    (questionId: string, correct: boolean) => {
      update(
        prev => ({
          ...prev,
          questionStats: recordAnswer(prev.questionStats, questionId, correct),
        }),
        { kind: 'questionStat', questionId },
      );
    },
    [update],
  );

  const recordMistake = useCallback(
    (questionId: string) => {
      if (stateRef.current.mistakeIds.includes(questionId)) {
        return;
      }
      update(
        prev =>
          prev.mistakeIds.includes(questionId)
            ? prev
            : { ...prev, mistakeIds: [...prev.mistakeIds, questionId] },
        { kind: 'set', type: 'mistake', id: questionId, op: 'add' },
      );
    },
    [update],
  );

  const clearMistake = useCallback(
    (questionId: string) => {
      update(
        prev => ({
          ...prev,
          mistakeIds: prev.mistakeIds.filter(id => id !== questionId),
        }),
        { kind: 'set', type: 'mistake', id: questionId, op: 'remove' },
      );
    },
    [update],
  );

  const setName = useCallback(
    (name: string) => {
      update(prev => ({ ...prev, user: { ...prev.user, name } }), {
        kind: 'profile',
      });
    },
    [update],
  );

  const setStateCode = useCallback(
    (stateCode: string) => {
      courseStore.setActiveCourse(courseIdForState(stateCode));
      update(prev => ({ ...prev, user: { ...prev.user, stateCode } }), {
        kind: 'profile',
      });
    },
    [update],
  );

  // Moving to another state's course: the old course's progress is wiped, on
  // this device and (via the wipe mark) on the server, so the new course
  // starts clean everywhere. Streak, saved signs and preferences survive —
  // they are not tied to a course. setStateCode above stays wipe-free for
  // onboarding, where there is nothing to lose yet.
  const changeStateWipingProgress = useCallback(
    (stateCode: string) => {
      courseStore.setActiveCourse(courseIdForState(stateCode));
      update(
        prev => ({
          ...prev,
          user: { ...prev.user, stateCode },
          lessonScores: {},
          topicScores: {},
          questionStats: {},
          bestExam: null,
          mistakeIds: [],
          savedQuestionIds: [],
        }),
        { kind: 'wipe' },
        { kind: 'profile' },
      );
    },
    [update],
  );

  const setAccent = useCallback(
    (accentId: AccentId) => {
      update(prev => ({ ...prev, accentId }), { kind: 'profile' });
    },
    [update],
  );

  const setFont = useCallback(
    (fontId: FontId) => {
      update(prev => ({ ...prev, fontId }), { kind: 'profile' });
    },
    [update],
  );

  // Local-only until RevenueCat lands; the server-side plan column is not
  // client-writable, so this is never pushed.
  const upgrade = useCallback(() => {
    setState(prev => ({ ...prev, user: { ...prev.user, plan: 'plus' } }));
  }, []);

  const value = useMemo<AppStateValue>(() => {
    const scores = Object.values(state.lessonScores);
    return {
      ...state,
      userId,
      points: scores.reduce((sum, score) => sum + score.points, 0),
      lessonsDone: scores.filter(score => score.completed).length,
      applyLessonResult,
      applyTopicResult,
      applyExamResult,
      setName,
      resetLessons,
      resetTopics,
      toggleSavedQuestion,
      toggleSavedSign,
      recordQuestionAnswer,
      recordMistake,
      clearMistake,
      setStateCode,
      changeStateWipingProgress,
      setAccent,
      setFont,
      upgrade,
    };
  }, [
    state,
    userId,
    applyLessonResult,
    applyTopicResult,
    setName,
    applyExamResult,
    resetLessons,
    resetTopics,
    toggleSavedQuestion,
    toggleSavedSign,
    recordQuestionAnswer,
    recordMistake,
    clearMistake,
    setStateCode,
    changeStateWipingProgress,
    setAccent,
    setFont,
    upgrade,
  ]);

  if (!hydrated) {
    return null;
  }

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = (): AppStateValue => {
  const value = useContext(AppStateContext);
  if (value == null) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return value;
};
