import type { LessonScore, PersistedState } from '@/state/AppState';
import { QuestionStats, mergeQuestionStats } from '@/state/questionStats';
import { StreakSpan, StreakState, normalizeStreak } from '@/state/streak';
import { normalizeAccentId } from '@/theme';

import {
  PendingSync,
  RemoteSnapshot,
  SetOpKind,
  SyncPushPayload,
  parseResetOpKey,
  parseSetOpKey,
  resetOpKey,
  setOpKey,
} from './types';

// Pure merge rules, mirroring the SQL in sync_push. Supabase is the source of
// truth: a pull replaces local progress with the server snapshot, then replays
// local operations that have not been pushed yet (dirty rows, set ops, reset
// ops). Within a row the domain is monotonic — points/best scores only grow,
// completed never un-completes — but rows themselves can be deleted via
// reset_ops, and deletions propagate to every device through the pull.

const mergeLessonScore = (
  local: LessonScore,
  remote: LessonScore,
  localDirty: boolean,
): LessonScore => ({
  // answered/correct describe the latest attempt — the dirty side is newer.
  answered: localDirty ? local.answered : remote.answered,
  correct: localDirty ? local.correct : remote.correct,
  points: Math.max(local.points, remote.points),
  completed: local.completed || remote.completed,
});

type StreakFields = StreakSpan & Partial<StreakState>;

// The most recent side carries the run; the lifetime stats (which the server
// does not store) are monotonic maxima across both sides, like bestExam.
const mergeStreak = (a: StreakFields, b: StreakFields): StreakState => {
  const span = (): StreakFields => {
    if (a.lastActiveDate == null) {
      return b;
    }
    if (b.lastActiveDate == null) {
      return a;
    }
    // YYYY-MM-DD compares correctly as a string.
    if (a.lastActiveDate === b.lastActiveDate) {
      return a.currentStreak >= b.currentStreak ? a : b;
    }
    return a.lastActiveDate > b.lastActiveDate ? a : b;
  };

  // A side without stats (the server profile) still contributes its run
  // length — its history is at least that long.
  return normalizeStreak({
    ...span(),
    longestStreak: Math.max(
      a.longestStreak ?? a.currentStreak,
      b.longestStreak ?? b.currentStreak,
    ),
    daysStudied: Math.max(
      a.daysStudied ?? a.currentStreak,
      b.daysStudied ?? b.currentStreak,
    ),
  });
};

const mergeSet = (
  remoteIds: string[],
  pendingOps: { id: string; op: SetOpKind }[],
): string[] => {
  const result = new Set(remoteIds);
  pendingOps.forEach(({ id, op }) => {
    if (op === 'add') {
      result.add(id);
    } else {
      result.delete(id);
    }
  });
  return [...result];
};

const pendingOpsFor = (
  pending: PendingSync,
  type: 'question' | 'sign' | 'mistake',
): { id: string; op: SetOpKind }[] =>
  Object.entries(pending.setOps)
    .map(([key, op]) => ({ ...parseSetOpKey(key), op }))
    .filter(entry => entry.type === type);

export const mergeRemoteIntoLocal = (
  local: PersistedState,
  remote: RemoteSnapshot,
  pending: PendingSync,
): PersistedState => {
  // An unpushed wipe means every progress row the server still holds is
  // already dead; merging it back would resurrect the old state's course.
  // Only the server-owned plan may flow in until the wipe lands.
  if (pending.wipeDirty) {
    return {
      ...local,
      user: {
        ...local.user,
        plan: remote.profile?.plan ?? local.user.plan,
      },
    };
  }
  // Server snapshot first: local rows absent remotely are dropped unless they
  // carry an unpushed change. A pending reset hides the remote row (the delete
  // has not reached the server yet).
  const lessonScores: Record<string, LessonScore> = {};
  remote.lessons.forEach(row => {
    if (pending.resetOps[resetOpKey('lesson', row.id)]) {
      return;
    }
    const remoteScore: LessonScore = {
      answered: row.answered,
      correct: row.correct,
      points: row.points,
      completed: row.completed,
    };
    const localScore = local.lessonScores[row.id];
    lessonScores[row.id] =
      localScore != null && pending.lessonIds.includes(row.id)
        ? mergeLessonScore(localScore, remoteScore, true)
        : remoteScore;
  });
  pending.lessonIds.forEach(id => {
    const localScore = local.lessonScores[id];
    if (localScore != null && lessonScores[id] == null) {
      lessonScores[id] = localScore;
    }
  });

  const topicScores: Record<string, number> = {};
  remote.topics.forEach(row => {
    if (pending.resetOps[resetOpKey('topic', row.id)]) {
      return;
    }
    const localScore = local.topicScores[row.id];
    topicScores[row.id] =
      localScore != null && pending.topicIds.includes(row.id)
        ? Math.max(localScore, row.best_percent)
        : row.best_percent;
  });
  pending.topicIds.forEach(id => {
    const localScore = local.topicScores[id];
    if (localScore != null && topicScores[id] == null) {
      topicScores[id] = localScore;
    }
  });

  // Question history, same shape as lessons/topics: the server snapshot wins
  // unless this device holds an unpushed answer for that question. A server
  // without migration 0004 sends nothing, so local history is kept whole
  // rather than wiped by an empty snapshot.
  const questionStats: QuestionStats = {};
  const remoteQuestionStats = remote.question_stats;
  if (remoteQuestionStats == null) {
    Object.assign(questionStats, local.questionStats);
  } else {
    remoteQuestionStats.forEach(row => {
      const localStat = local.questionStats[row.id];
      const remoteStat = {
        seen: row.seen,
        correct: row.correct,
        lastCorrect: row.last_correct,
      };
      questionStats[row.id] =
        localStat != null && pending.questionStatIds.includes(row.id)
          ? // Both sides unpushed-or-newer: the longer history wins, as a
            // unit — the same rule sync_push applies server-side.
            mergeQuestionStats(
              { [row.id]: localStat },
              { [row.id]: remoteStat },
            )[row.id]
          : remoteStat;
    });
    pending.questionStatIds.forEach(id => {
      const localStat = local.questionStats[id];
      if (localStat != null && questionStats[id] == null) {
        questionStats[id] = localStat;
      }
    });
  }

  const profile = remote.profile;
  const keepLocalProfile = profile == null || pending.profileDirty;

  const remoteBestExam = profile?.best_exam ?? null;
  const bestExam =
    local.bestExam == null && remoteBestExam == null
      ? null
      : Math.max(local.bestExam ?? 0, remoteBestExam ?? 0);

  const streak = profile
    ? mergeStreak(local.streak, {
        currentStreak: profile.current_streak,
        lastActiveDate: profile.last_active_date,
        // Pre-0004 servers omit these; mergeStreak then falls back to the
        // run length, which is the floor for both.
        longestStreak: profile.longest_streak,
        daysStudied: profile.days_studied,
      })
    : local.streak;

  return {
    ...local,
    user: {
      name: keepLocalProfile ? local.user.name : profile.name,
      stateCode: keepLocalProfile ? local.user.stateCode : profile.state_code,
      // plan is server-owned (pull-only) until RevenueCat lands.
      plan: profile?.plan ?? local.user.plan,
    },
    accentId: keepLocalProfile
      ? local.accentId
      : // The server column is free text and may still hold an accent this
        // build dropped.
        normalizeAccentId(profile.accent_id),
    fontId: keepLocalProfile
      ? local.fontId
      : (profile.font_id as PersistedState['fontId']),
    lessonScores,
    topicScores,
    bestExam,
    questionStats,
    streak,
    savedQuestionIds: mergeSet(
      remote.saved.filter(item => item.type === 'question').map(i => i.id),
      pendingOpsFor(pending, 'question'),
    ),
    savedSignIds: mergeSet(
      remote.saved.filter(item => item.type === 'sign').map(i => i.id),
      pendingOpsFor(pending, 'sign'),
    ),
    mistakeIds: mergeSet(remote.mistakes, pendingOpsFor(pending, 'mistake')),
  };
};

// Union of two local states — used when signing into an existing account with
// progress already on the device (adopt-and-merge). `base` is the account
// being signed into; its identity-ish fields win.
export const mergeLocalStates = (
  base: PersistedState,
  incoming: PersistedState,
): PersistedState => {
  const lessonScores: Record<string, LessonScore> = {
    ...incoming.lessonScores,
  };
  Object.entries(base.lessonScores).forEach(([lessonId, score]) => {
    const other = lessonScores[lessonId];
    lessonScores[lessonId] = other
      ? {
          // max on both keeps correct <= answered as long as each side is
          // internally consistent.
          answered: Math.max(score.answered, other.answered),
          correct: Math.max(score.correct, other.correct),
          points: Math.max(score.points, other.points),
          completed: score.completed || other.completed,
        }
      : score;
  });

  const topicScores: Record<string, number> = { ...incoming.topicScores };
  Object.entries(base.topicScores).forEach(([topicId, percent]) => {
    topicScores[topicId] = Math.max(percent, topicScores[topicId] ?? 0);
  });

  return {
    ...base,
    user: {
      ...base.user,
      name: base.user.name || incoming.user.name,
    },
    lessonScores,
    topicScores,
    bestExam:
      base.bestExam == null && incoming.bestExam == null
        ? null
        : Math.max(base.bestExam ?? 0, incoming.bestExam ?? 0),
    streak: mergeStreak(base.streak, incoming.streak),
    questionStats: mergeQuestionStats(
      base.questionStats,
      incoming.questionStats,
    ),
    savedQuestionIds: [
      ...new Set([...base.savedQuestionIds, ...incoming.savedQuestionIds]),
    ],
    savedSignIds: [
      ...new Set([...base.savedSignIds, ...incoming.savedSignIds]),
    ],
    mistakeIds: [...new Set([...base.mistakeIds, ...incoming.mistakeIds])],
  };
};

export const buildPushPayload = (
  state: PersistedState,
  pending: PendingSync,
): SyncPushPayload => {
  const payload: SyncPushPayload = {
    lessons: pending.lessonIds
      .filter(id => state.lessonScores[id] != null)
      .map(id => ({ id, ...state.lessonScores[id] })),
    topics: pending.topicIds
      .filter(id => state.topicScores[id] != null)
      .map(id => ({ id, best_percent: state.topicScores[id] })),
    question_stats: pending.questionStatIds
      .filter(id => state.questionStats[id] != null)
      .map(id => {
        const stat = state.questionStats[id];
        return {
          id,
          seen: stat.seen,
          correct: stat.correct,
          last_correct: stat.lastCorrect,
        };
      }),
    set_ops: Object.entries(pending.setOps).map(([key, op]) => ({
      ...parseSetOpKey(key),
      op,
    })),
    // A row may appear both here and in lessons/topics (reset, then a fresh
    // attempt before the flush) — the server deletes first, then upserts.
    reset_ops: Object.keys(pending.resetOps).map(parseResetOpKey),
  };
  if (pending.wipeDirty) {
    payload.wipe_progress = true;
  }
  if (pending.examDirty && state.bestExam != null) {
    payload.best_exam = state.bestExam;
  }
  if (pending.profileDirty) {
    payload.profile = {
      name: state.user.name,
      state_code: state.user.stateCode,
      accent_id: state.accentId,
      font_id: state.fontId,
    };
  }
  if (pending.streakDirty && state.streak.lastActiveDate != null) {
    payload.streak = {
      current_streak: state.streak.currentStreak,
      last_active_date: state.streak.lastActiveDate,
      longest_streak: state.streak.longestStreak,
      days_studied: state.streak.daysStudied,
    };
  }
  return payload;
};

// Marks everything in a state as needing a push — used after adopt-and-merge,
// where the safest move is to re-send the full (already merged) picture.
export const pendingForFullState = (state: PersistedState): PendingSync => ({
  lessonIds: Object.keys(state.lessonScores),
  topicIds: Object.keys(state.topicScores),
  questionStatIds: Object.keys(state.questionStats),
  // An adopted snapshot is data to push, never an instruction to delete.
  wipeDirty: false,
  examDirty: state.bestExam != null,
  profileDirty: true,
  streakDirty: state.streak.lastActiveDate != null,
  setOps: Object.fromEntries([
    ...state.savedQuestionIds.map(id => [setOpKey('question', id), 'add']),
    ...state.savedSignIds.map(id => [setOpKey('sign', id), 'add']),
    ...state.mistakeIds.map(id => [setOpKey('mistake', id), 'add']),
  ]),
  // Resets are operations, not state — an adopted snapshot carries none.
  resetOps: {},
});
