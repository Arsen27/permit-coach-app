import {
  buildPushPayload,
  mergeLocalStates,
  mergeRemoteIntoLocal,
  pendingForFullState,
} from '@/sync/merge';
import { RemoteSnapshot, emptyPending, markPending } from '@/sync/types';
import { PersistedState, initialState } from '@/state/AppState';

const emptyRemote: RemoteSnapshot = {
  profile: null,
  lessons: [],
  topics: [],
  saved: [],
  mistakes: [],
};

const localWithProgress = (): PersistedState => ({
  ...initialState,
  lessonScores: {
    l1: { answered: 8, correct: 6, points: 40, completed: true },
  },
  topicScores: { t1: 50 },
  questionStats: { qs1: { seen: 3, correct: 2, lastCorrect: true } },
  bestExam: 70,
  savedQuestionIds: ['q1'],
  savedSignIds: ['s1'],
  mistakeIds: ['m1'],
  streak: {
    currentStreak: 2,
    lastActiveDate: '2026-07-30',
    longestStreak: 4,
    daysStudied: 9,
  },
});

describe('mergeRemoteIntoLocal', () => {
  it('takes remote rows the device has never seen', () => {
    const remote: RemoteSnapshot = {
      ...emptyRemote,
      lessons: [
        { id: 'l9', answered: 5, correct: 5, points: 60, completed: true },
      ],
      topics: [{ id: 't9', best_percent: 80 }],
      saved: [{ type: 'question', id: 'q9' }],
      mistakes: ['m9'],
    };
    const merged = mergeRemoteIntoLocal(initialState, remote, emptyPending());
    expect(merged.lessonScores.l9.points).toBe(60);
    expect(merged.topicScores.t9).toBe(80);
    expect(merged.savedQuestionIds).toEqual(['q9']);
    expect(merged.mistakeIds).toEqual(['m9']);
  });

  it('takes the server row verbatim when the local row has no pending change', () => {
    // Supabase is the source of truth: without an unpushed local change there
    // is nothing to replay, so the pulled row replaces the local one.
    const local = localWithProgress();
    const remote: RemoteSnapshot = {
      ...emptyRemote,
      lessons: [
        { id: 'l1', answered: 4, correct: 4, points: 90, completed: false },
      ],
      topics: [{ id: 't1', best_percent: 30 }],
    };
    const merged = mergeRemoteIntoLocal(local, remote, emptyPending());
    expect(merged.lessonScores.l1).toEqual({
      answered: 4,
      correct: 4,
      points: 90,
      completed: false,
    });
    expect(merged.topicScores.t1).toBe(30);
  });

  it('drops local rows absent from the server snapshot unless pending', () => {
    // A reset on another device deleted l1/t1 server-side; this device must
    // converge. l2/t2 carry unpushed local progress and survive the pull.
    const local: PersistedState = {
      ...localWithProgress(),
      lessonScores: {
        l1: { answered: 8, correct: 6, points: 40, completed: true },
        l2: { answered: 2, correct: 2, points: 100, completed: true },
      },
      topicScores: { t1: 50, t2: 80 },
    };
    let pending = markPending(emptyPending(), {
      kind: 'lesson',
      lessonId: 'l2',
    });
    pending = markPending(pending, { kind: 'topic', topicId: 't2' });

    const merged = mergeRemoteIntoLocal(local, emptyRemote, pending);
    expect(merged.lessonScores.l1).toBeUndefined();
    expect(merged.lessonScores.l2?.points).toBe(100);
    expect(merged.topicScores.t1).toBeUndefined();
    expect(merged.topicScores.t2).toBe(80);
  });

  it('does not resurrect rows with a pending reset', () => {
    // The reset has not been pushed yet, so the server still returns the row;
    // replaying the pending reset keeps it deleted locally.
    const local: PersistedState = {
      ...localWithProgress(),
      lessonScores: {},
      topicScores: {},
    };
    let pending = markPending(emptyPending(), {
      kind: 'reset',
      type: 'lesson',
      id: 'l1',
    });
    pending = markPending(pending, { kind: 'reset', type: 'topic', id: 't1' });
    const remote: RemoteSnapshot = {
      ...emptyRemote,
      lessons: [
        { id: 'l1', answered: 8, correct: 6, points: 40, completed: true },
      ],
      topics: [{ id: 't1', best_percent: 50 }],
    };
    const merged = mergeRemoteIntoLocal(local, remote, pending);
    expect(merged.lessonScores.l1).toBeUndefined();
    expect(merged.topicScores.t1).toBeUndefined();
  });

  it('keeps a fresh attempt made after a still-pending reset', () => {
    // Reset, then a new quiz run before any flush: the local row rides the
    // lesson mark; the stale server row is hidden by the reset op.
    const local: PersistedState = {
      ...localWithProgress(),
      lessonScores: {
        l1: { answered: 2, correct: 1, points: 50, completed: true },
      },
    };
    let pending = markPending(emptyPending(), {
      kind: 'reset',
      type: 'lesson',
      id: 'l1',
    });
    pending = markPending(pending, { kind: 'lesson', lessonId: 'l1' });
    const remote: RemoteSnapshot = {
      ...emptyRemote,
      lessons: [
        { id: 'l1', answered: 8, correct: 8, points: 95, completed: true },
      ],
    };
    const merged = mergeRemoteIntoLocal(local, remote, pending);
    expect(merged.lessonScores.l1?.points).toBe(50);
    expect(merged.lessonScores.l1?.answered).toBe(2);
  });

  it('lets a dirty local lesson keep its latest attempt fields', () => {
    const local = localWithProgress();
    const pending = markPending(emptyPending(), {
      kind: 'lesson',
      lessonId: 'l1',
    });
    const remote: RemoteSnapshot = {
      ...emptyRemote,
      lessons: [
        { id: 'l1', answered: 3, correct: 1, points: 10, completed: false },
      ],
    };
    const merged = mergeRemoteIntoLocal(local, remote, pending);
    expect(merged.lessonScores.l1.answered).toBe(8);
    expect(merged.lessonScores.l1.correct).toBe(6);
  });

  it('applies pending set deltas on top of the remote set', () => {
    const local = localWithProgress();
    let pending = emptyPending();
    pending = markPending(pending, {
      kind: 'set',
      type: 'question',
      id: 'q1',
      op: 'add',
    });
    const remote: RemoteSnapshot = {
      ...emptyRemote,
      saved: [{ type: 'question', id: 'q2' }],
    };
    const merged = mergeRemoteIntoLocal(local, remote, pending);
    expect(merged.savedQuestionIds.sort()).toEqual(['q1', 'q2']);
  });

  it('falls back to the default accent when the server names a dropped one', () => {
    // An older build could have written any accent id into the profile.
    const merged = mergeRemoteIntoLocal(
      localWithProgress(),
      {
        ...emptyRemote,
        profile: {
          name: '',
          state_code: 'CA',
          plan: 'free',
          accent_id: 'jade',
          font_id: 'jakarta',
          best_exam: null,
          current_streak: 0,
          last_active_date: null,
        },
      },
      emptyPending(),
    );
    expect(merged.accentId).toBe('emerald');
  });

  it('drops a local set item deleted remotely with no pending op', () => {
    // q1 was synced earlier and un-saved on another device.
    const local = localWithProgress();
    const merged = mergeRemoteIntoLocal(local, emptyRemote, emptyPending());
    expect(merged.savedQuestionIds).toEqual([]);
  });

  it('takes profile fields from the server unless locally dirty', () => {
    const local = localWithProgress();
    const remote: RemoteSnapshot = {
      ...emptyRemote,
      profile: {
        name: 'Ada',
        state_code: 'NY',
        plan: 'plus',
        accent_id: 'emerald',
        font_id: 'inter',
        best_exam: 90,
        current_streak: 7,
        last_active_date: '2026-07-31',
      },
    };
    const clean = mergeRemoteIntoLocal(local, remote, emptyPending());
    expect(clean.user.name).toBe('Ada');
    expect(clean.user.stateCode).toBe('NY');
    expect(clean.user.plan).toBe('plus');
    expect(clean.accentId).toBe('emerald');
    expect(clean.bestExam).toBe(90);
    expect(clean.streak.currentStreak).toBe(7);

    const dirty = mergeRemoteIntoLocal(
      local,
      remote,
      markPending(emptyPending(), { kind: 'profile' }),
    );
    expect(dirty.user.stateCode).toBe('CA');
    // plan stays server-owned even when the profile is dirty.
    expect(dirty.user.plan).toBe('plus');
  });

  it('keeps the streak with the later active date', () => {
    const local = localWithProgress();
    const remote: RemoteSnapshot = {
      ...emptyRemote,
      profile: {
        name: '',
        state_code: 'CA',
        plan: 'free',
        accent_id: 'blue',
        font_id: 'jakarta',
        best_exam: null,
        current_streak: 10,
        last_active_date: '2026-07-29',
      },
    };
    const merged = mergeRemoteIntoLocal(local, remote, emptyPending());
    // The later local date wins the run; the server's longer (older) run
    // still raises the lifetime stats, which the server does not store.
    expect(merged.streak).toEqual({
      currentStreak: 2,
      lastActiveDate: '2026-07-30',
      longestStreak: 10,
      daysStudied: 10,
    });
  });
});

describe('question stats over sync', () => {
  it('takes the server history when the device has nothing pending', () => {
    const local = localWithProgress();
    const merged = mergeRemoteIntoLocal(
      local,
      {
        ...emptyRemote,
        question_stats: [
          { id: 'qs1', seen: 9, correct: 9, last_correct: true },
          { id: 'qs2', seen: 1, correct: 0, last_correct: false },
        ],
      },
      emptyPending(),
    );
    expect(merged.questionStats.qs1).toEqual({
      seen: 9,
      correct: 9,
      lastCorrect: true,
    });
    expect(merged.questionStats.qs2).toEqual({
      seen: 1,
      correct: 0,
      lastCorrect: false,
    });
  });

  it('drops a local row the server does not have and nothing is pending for', () => {
    const merged = mergeRemoteIntoLocal(
      localWithProgress(),
      { ...emptyRemote, question_stats: [] },
      emptyPending(),
    );
    expect(merged.questionStats).toEqual({});
  });

  it('keeps an unpushed local answer the server has never seen', () => {
    const pending = markPending(emptyPending(), {
      kind: 'questionStat',
      questionId: 'qs1',
    });
    const merged = mergeRemoteIntoLocal(
      localWithProgress(),
      { ...emptyRemote, question_stats: [] },
      pending,
    );
    expect(merged.questionStats.qs1).toEqual({
      seen: 3,
      correct: 2,
      lastCorrect: true,
    });
  });

  it('keeps the longer history when both sides changed', () => {
    const pending = markPending(emptyPending(), {
      kind: 'questionStat',
      questionId: 'qs1',
    });
    const local = localWithProgress(); // qs1 seen 3

    const serverAhead = mergeRemoteIntoLocal(
      local,
      {
        ...emptyRemote,
        question_stats: [
          { id: 'qs1', seen: 6, correct: 4, last_correct: false },
        ],
      },
      pending,
    );
    expect(serverAhead.questionStats.qs1).toEqual({
      seen: 6,
      correct: 4,
      lastCorrect: false,
    });

    const deviceAhead = mergeRemoteIntoLocal(
      local,
      {
        ...emptyRemote,
        question_stats: [
          { id: 'qs1', seen: 1, correct: 1, last_correct: true },
        ],
      },
      pending,
    );
    expect(deviceAhead.questionStats.qs1).toEqual({
      seen: 3,
      correct: 2,
      lastCorrect: true,
    });
  });

  it('keeps local history whole against a server without migration 0004', () => {
    // question_stats absent (not empty): the old sync_pull simply has no such
    // key, and an empty snapshot must not be read as "the server deleted it".
    const merged = mergeRemoteIntoLocal(
      localWithProgress(),
      emptyRemote,
      emptyPending(),
    );
    expect(merged.questionStats.qs1).toEqual({
      seen: 3,
      correct: 2,
      lastCorrect: true,
    });
  });

  it('pushes only the questions marked dirty', () => {
    const state: PersistedState = {
      ...localWithProgress(),
      questionStats: {
        qs1: { seen: 3, correct: 2, lastCorrect: true },
        qs2: { seen: 1, correct: 1, lastCorrect: true },
      },
    };
    const pending = markPending(emptyPending(), {
      kind: 'questionStat',
      questionId: 'qs2',
    });
    expect(buildPushPayload(state, pending).question_stats).toEqual([
      { id: 'qs2', seen: 1, correct: 1, last_correct: true },
    ]);
  });
});

describe('streak history over sync', () => {
  it('raises the lifetime stats from the server profile', () => {
    const merged = mergeRemoteIntoLocal(
      localWithProgress(), // longest 4, days 9
      {
        ...emptyRemote,
        profile: {
          name: '',
          state_code: 'CA',
          plan: 'free',
          accent_id: 'blue',
          font_id: 'jakarta',
          best_exam: null,
          current_streak: 2,
          last_active_date: '2026-07-30',
          longest_streak: 11,
          days_studied: 23,
        },
      },
      emptyPending(),
    );
    expect(merged.streak.longestStreak).toBe(11);
    expect(merged.streak.daysStudied).toBe(23);
  });

  it('never lowers local lifetime stats to a smaller server value', () => {
    const merged = mergeRemoteIntoLocal(
      localWithProgress(),
      {
        ...emptyRemote,
        profile: {
          name: '',
          state_code: 'CA',
          plan: 'free',
          accent_id: 'blue',
          font_id: 'jakarta',
          best_exam: null,
          current_streak: 2,
          last_active_date: '2026-07-30',
          longest_streak: 1,
          days_studied: 1,
        },
      },
      emptyPending(),
    );
    expect(merged.streak.longestStreak).toBe(4);
    expect(merged.streak.daysStudied).toBe(9);
  });

  it('falls back to the run length against a pre-0004 server profile', () => {
    const merged = mergeRemoteIntoLocal(
      { ...initialState },
      {
        ...emptyRemote,
        profile: {
          name: '',
          state_code: 'CA',
          plan: 'free',
          accent_id: 'blue',
          font_id: 'jakarta',
          best_exam: null,
          current_streak: 5,
          last_active_date: '2026-07-30',
        },
      },
      emptyPending(),
    );
    // The run itself is the floor for both — normalizeStreak's rule.
    expect(merged.streak.currentStreak).toBe(5);
    expect(merged.streak.longestStreak).toBe(5);
    expect(merged.streak.daysStudied).toBe(5);
  });
});

describe('mergeLocalStates', () => {
  it('unions progress and sets, keeps base identity fields', () => {
    const base: PersistedState = {
      ...initialState,
      user: { name: 'Ada', stateCode: 'NY', plan: 'free' },
      lessonScores: {
        l1: { answered: 4, correct: 4, points: 20, completed: false },
      },
      savedQuestionIds: ['q2'],
    };
    const incoming = localWithProgress();
    const merged = mergeLocalStates(base, incoming);
    expect(merged.user.stateCode).toBe('NY');
    expect(merged.lessonScores.l1).toEqual({
      answered: 8,
      correct: 6,
      points: 40,
      completed: true,
    });
    expect(merged.savedQuestionIds.sort()).toEqual(['q1', 'q2']);
    expect(merged.bestExam).toBe(70);
  });
});

describe('buildPushPayload', () => {
  it('sends only dirty entities, with values from the current state', () => {
    const state = localWithProgress();
    let pending = emptyPending();
    pending = markPending(pending, { kind: 'lesson', lessonId: 'l1' });
    pending = markPending(pending, { kind: 'exam' });
    pending = markPending(pending, { kind: 'streak' });
    pending = markPending(pending, {
      kind: 'set',
      type: 'mistake',
      id: 'm1',
      op: 'add',
    });

    const payload = buildPushPayload(state, pending);
    expect(payload.lessons).toEqual([
      { id: 'l1', answered: 8, correct: 6, points: 40, completed: true },
    ]);
    expect(payload.topics).toEqual([]);
    expect(payload.best_exam).toBe(70);
    expect(payload.profile).toBeUndefined();
    expect(payload.streak).toEqual({
      current_streak: 2,
      last_active_date: '2026-07-30',
      longest_streak: 4,
      days_studied: 9,
    });
    expect(payload.set_ops).toEqual([{ type: 'mistake', id: 'm1', op: 'add' }]);
    expect(payload.reset_ops).toEqual([]);
  });

  it('sends reset ops, alone or alongside a fresh attempt on the same id', () => {
    const state: PersistedState = {
      ...localWithProgress(),
      lessonScores: {
        l1: { answered: 2, correct: 2, points: 55, completed: true },
      },
    };
    let pending = emptyPending();
    // l1: reset, then retaken before the flush → delete + upsert in one push.
    pending = markPending(pending, { kind: 'reset', type: 'lesson', id: 'l1' });
    pending = markPending(pending, { kind: 'lesson', lessonId: 'l1' });
    // l2: reset with no retake — the local row is gone, only the delete goes.
    pending = markPending(pending, { kind: 'reset', type: 'lesson', id: 'l2' });
    pending = markPending(pending, { kind: 'reset', type: 'topic', id: 't1' });

    const payload = buildPushPayload(state, pending);
    expect(payload.reset_ops).toEqual([
      { type: 'lesson', id: 'l1' },
      { type: 'lesson', id: 'l2' },
      { type: 'topic', id: 't1' },
    ]);
    expect(payload.lessons).toEqual([
      { id: 'l1', answered: 2, correct: 2, points: 55, completed: true },
    ]);
  });
});

describe('pendingForFullState', () => {
  it('marks every entity in the state dirty', () => {
    const pending = pendingForFullState(localWithProgress());
    expect(pending.lessonIds).toEqual(['l1']);
    expect(pending.topicIds).toEqual(['t1']);
    expect(pending.questionStatIds).toEqual(['qs1']);
    expect(pending.examDirty).toBe(true);
    expect(pending.profileDirty).toBe(true);
    expect(pending.streakDirty).toBe(true);
    expect(pending.setOps).toEqual({
      'question:q1': 'add',
      'sign:s1': 'add',
      'mistake:m1': 'add',
    });
  });
});
