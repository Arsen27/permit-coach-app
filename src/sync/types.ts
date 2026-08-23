// User id used before the first successful (anonymous) Supabase sign-in.
// Data stored under it is adopted into the real user id once one exists.
export const LOCAL_USER_ID = 'local';

export type SetItemType = 'question' | 'sign' | 'mistake';
export type SetOpKind = 'add' | 'remove';
export type ResetItemType = 'lesson' | 'topic';

export type DirtyMark =
  | { kind: 'lesson'; lessonId: string }
  | { kind: 'topic'; topicId: string }
  | { kind: 'questionStat'; questionId: string }
  | { kind: 'exam' }
  | { kind: 'profile' }
  | { kind: 'streak' }
  // The learner switched state: every course-progress row dies, locally and
  // on the server. Applied before upserts, like reset_ops.
  | { kind: 'wipe' }
  | { kind: 'set'; type: SetItemType; id: string; op: SetOpKind }
  // A course update invalidated this progress row: delete it on the server.
  | { kind: 'reset'; type: ResetItemType; id: string };

// Keys of entities changed locally and not yet pushed. Carries only keys and
// set deltas — push payload values are read from the current state at flush
// time, so the queue can never hold stale data.
export type PendingSync = {
  lessonIds: string[];
  topicIds: string[];
  questionStatIds: string[];
  wipeDirty: boolean;
  examDirty: boolean;
  profileDirty: boolean;
  streakDirty: boolean;
  setOps: Record<string, SetOpKind>;
  resetOps: Record<string, true>;
};

export const setOpKey = (type: SetItemType, id: string): string =>
  `${type}:${id}`;

export const parseSetOpKey = (
  key: string,
): { type: SetItemType; id: string } => {
  const separator = key.indexOf(':');
  return {
    type: key.slice(0, separator) as SetItemType,
    id: key.slice(separator + 1),
  };
};

export const resetOpKey = (type: ResetItemType, id: string): string =>
  `${type}:${id}`;

export const parseResetOpKey = (
  key: string,
): { type: ResetItemType; id: string } => {
  const separator = key.indexOf(':');
  return {
    type: key.slice(0, separator) as ResetItemType,
    id: key.slice(separator + 1),
  };
};

export const emptyPending = (): PendingSync => ({
  lessonIds: [],
  topicIds: [],
  questionStatIds: [],
  wipeDirty: false,
  examDirty: false,
  profileDirty: false,
  streakDirty: false,
  setOps: {},
  resetOps: {},
});

export const isPendingEmpty = (pending: PendingSync): boolean =>
  pending.lessonIds.length === 0 &&
  pending.topicIds.length === 0 &&
  pending.questionStatIds.length === 0 &&
  !pending.wipeDirty &&
  !pending.examDirty &&
  !pending.profileDirty &&
  !pending.streakDirty &&
  Object.keys(pending.setOps).length === 0 &&
  Object.keys(pending.resetOps).length === 0;

const addUnique = (ids: string[], id: string): string[] =>
  ids.includes(id) ? ids : [...ids, id];

export const markPending = (
  pending: PendingSync,
  mark: DirtyMark,
): PendingSync => {
  switch (mark.kind) {
    case 'lesson':
      return {
        ...pending,
        lessonIds: addUnique(pending.lessonIds, mark.lessonId),
      };
    case 'topic':
      return {
        ...pending,
        topicIds: addUnique(pending.topicIds, mark.topicId),
      };
    case 'questionStat':
      return {
        ...pending,
        questionStatIds: addUnique(pending.questionStatIds, mark.questionId),
      };
    case 'exam':
      return { ...pending, examDirty: true };
    case 'profile':
      return { ...pending, profileDirty: true };
    case 'streak':
      return { ...pending, streakDirty: true };
    case 'wipe':
      // A wipe supersedes any queued progress: rows marked before the wipe
      // no longer exist locally, and pushing them would resurrect them.
      return {
        ...pending,
        wipeDirty: true,
        lessonIds: [],
        topicIds: [],
        questionStatIds: [],
        examDirty: false,
        setOps: {},
        resetOps: {},
      };
    case 'set':
      // Toggling twice self-compacts: the last op for an item wins.
      return {
        ...pending,
        setOps: { ...pending.setOps, [setOpKey(mark.type, mark.id)]: mark.op },
      };
    case 'reset':
      return {
        ...pending,
        resetOps: {
          ...pending.resetOps,
          [resetOpKey(mark.type, mark.id)]: true,
        },
      };
  }
};

// Union of two queues; `later` wins where a set op differs.
export const mergePending = (
  earlier: PendingSync,
  later: PendingSync,
): PendingSync => ({
  lessonIds: [...new Set([...earlier.lessonIds, ...later.lessonIds])],
  topicIds: [...new Set([...earlier.topicIds, ...later.topicIds])],
  questionStatIds: [
    ...new Set([...earlier.questionStatIds, ...later.questionStatIds]),
  ],
  wipeDirty: earlier.wipeDirty || later.wipeDirty,
  examDirty: earlier.examDirty || later.examDirty,
  profileDirty: earlier.profileDirty || later.profileDirty,
  streakDirty: earlier.streakDirty || later.streakDirty,
  setOps: { ...earlier.setOps, ...later.setOps },
  resetOps: { ...earlier.resetOps, ...later.resetOps },
});

// Removes everything covered by a successfully pushed snapshot, keeping marks
// that arrived while the push was in flight (including a set op that changed).
export const subtractPending = (
  pending: PendingSync,
  pushed: PendingSync,
): PendingSync => ({
  lessonIds: pending.lessonIds.filter(id => !pushed.lessonIds.includes(id)),
  topicIds: pending.topicIds.filter(id => !pushed.topicIds.includes(id)),
  questionStatIds: pending.questionStatIds.filter(
    id => !pushed.questionStatIds.includes(id),
  ),
  wipeDirty: pending.wipeDirty && !pushed.wipeDirty,
  examDirty: pending.examDirty && !pushed.examDirty,
  profileDirty: pending.profileDirty && !pushed.profileDirty,
  streakDirty: pending.streakDirty && !pushed.streakDirty,
  setOps: Object.fromEntries(
    Object.entries(pending.setOps).filter(
      ([key, op]) => pushed.setOps[key] !== op,
    ),
  ),
  resetOps: Object.fromEntries(
    Object.entries(pending.resetOps).filter(
      ([key]) => pushed.resetOps[key] == null,
    ),
  ),
});

// What `sync_push` receives. Field names match the SQL side.
export type SyncPushPayload = {
  lessons: {
    id: string;
    answered: number;
    correct: number;
    points: number;
    completed: boolean;
  }[];
  topics: { id: string; best_percent: number }[];
  question_stats: {
    id: string;
    seen: number;
    correct: number;
    last_correct: boolean;
  }[];
  set_ops: { type: SetItemType; id: string; op: SetOpKind }[];
  // Applied server-side BEFORE the lesson/topic upserts, so "reset then a
  // fresh attempt" in one push ends with exactly the fresh attempt.
  reset_ops: { type: ResetItemType; id: string }[];
  // Applied before everything else: deletes every progress row and clears
  // best_exam, so rows pushed in the same payload survive as the new truth.
  wipe_progress?: boolean;
  best_exam?: number;
  profile?: {
    name: string;
    state_code: string;
    accent_id: string;
    font_id: string;
  };
  streak?: {
    current_streak: number;
    last_active_date: string;
    longest_streak: number;
    days_studied: number;
  };
};

// What `sync_pull` returns.
export type RemoteSnapshot = {
  profile: {
    name: string;
    state_code: string;
    plan: 'free' | 'plus';
    accent_id: string;
    font_id: string;
    best_exam: number | null;
    current_streak: number;
    last_active_date: string | null;
    // Absent until migration 0004 has been applied to the project.
    longest_streak?: number;
    days_studied?: number;
  } | null;
  lessons: {
    id: string;
    answered: number;
    correct: number;
    points: number;
    completed: boolean;
  }[];
  topics: { id: string; best_percent: number }[];
  // Absent until migration 0004 has been applied to the project.
  question_stats?: {
    id: string;
    seen: number;
    correct: number;
    last_correct: boolean;
  }[];
  saved: { type: 'question' | 'sign'; id: string }[];
  mistakes: string[];
};
