import { create } from 'zustand';

import { adminApi } from '@admin/api/adminApi';
import { ApiError } from '@admin/api/client';
import type {
  BankChannels,
  Channel,
  ChannelMove,
  QuestionBankDoc,
} from '@admin/api/types';
import type { CourseQuestionV2 } from '@/data/course/v2/wire';

// The published question bank of one course. Like the signs catalogue and
// for the same reason: questions are their own entity, so a fix to one has
// nothing to do with a course release. `saved` is the working document as
// the server holds it, `doc` the working copy, Save rewrites it, and
// publishing points a channel at a snapshot — staging first, then everyone.

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

type BankState = {
  courseId: string | null;
  saved: QuestionBankDoc | null;
  doc: QuestionBankDoc | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  channels: BankChannels | null;
  history: ChannelMove[] | null;

  open: (courseId: string) => Promise<void>;
  // Re-reads what each channel serves and what the working document holds,
  // without disturbing the question being edited.
  refreshChannels: () => Promise<void>;
  mutate: (mutator: (doc: QuestionBankDoc) => void) => void;
  revert: () => void;
  save: () => Promise<string[] | null>;
  publish: (
    channel: Channel,
    sha256?: string,
  ) => Promise<{ ok: boolean; detail: string }>;
};

// Questions that differ from what the server holds, for the footer count.
export const changedQuestionCount = (state: BankState): number => {
  if (state.saved == null || state.doc == null) {
    return 0;
  }
  const before = new Map(
    state.saved.questions.map(question => [
      question.questionId,
      JSON.stringify(question),
    ]),
  );
  const changed = state.doc.questions.filter(
    question => before.get(question.questionId) !== JSON.stringify(question),
  ).length;
  const kept = new Set(state.doc.questions.map(q => q.questionId));
  return (
    changed + state.saved.questions.filter(q => !kept.has(q.questionId)).length
  );
};

export const findBankQuestion = (
  doc: QuestionBankDoc | null,
  questionId: string | null,
): CourseQuestionV2 | undefined =>
  questionId == null
    ? undefined
    : doc?.questions.find(question => question.questionId === questionId);

export const useBank = create<BankState>((set, get) => ({
  courseId: null,
  saved: null,
  doc: null,
  loading: false,
  saving: false,
  error: null,
  channels: null,
  history: null,

  open: async courseId => {
    set({ courseId, loading: true, error: null, doc: null, saved: null });
    try {
      const doc = await adminApi.bankDoc(courseId);
      set({ loading: false, saved: clone(doc), doc: clone(doc) });
    } catch (error) {
      set({
        loading: false,
        error:
          error instanceof ApiError
            ? error.message
            : 'Could not load the question bank — check the server log',
      });
    }
    // Channels and history are informational: a failure to read them must
    // not hide the questions.
    await Promise.all([
      adminApi
        .bankChannels(courseId)
        .then(channels => set({ channels }))
        .catch(() => set({ channels: null })),
      adminApi
        .bankHistory(courseId, 20)
        .then(({ moves }) => set({ history: moves }))
        .catch(() => set({ history: [] })),
    ]);
  },

  refreshChannels: async () => {
    const courseId = get().courseId;
    if (courseId == null) {
      return;
    }
    await adminApi
      .bankChannels(courseId)
      .then(channels => set({ channels }))
      .catch(() => undefined);
  },

  mutate: mutator => {
    set(state => {
      if (state.doc == null) {
        return {};
      }
      const doc = clone(state.doc);
      mutator(doc);
      return { doc };
    });
  },

  revert: () => {
    set(state => (state.saved == null ? {} : { doc: clone(state.saved) }));
  },

  save: async () => {
    const { doc, courseId } = get();
    if (doc == null || courseId == null) {
      return ['nothing to save'];
    }
    set({ saving: true });
    try {
      await adminApi.saveBankDoc(courseId, doc);
      set({ saving: false, saved: clone(doc) });
      return null;
    } catch (error) {
      set({ saving: false });
      if (error instanceof ApiError && Array.isArray(error.errors)) {
        return error.errors;
      }
      return [
        error instanceof Error ? error.message : 'save failed — server log',
      ];
    }
  },

  publish: async (channel, sha256) => {
    const courseId = get().courseId;
    if (courseId == null) {
      return { ok: false, detail: 'no course open' };
    }
    try {
      const move = await adminApi.publishBank(courseId, channel, sha256);
      const [channels, history] = await Promise.all([
        adminApi.bankChannels(courseId).catch(() => null),
        adminApi
          .bankHistory(courseId, 20)
          .then(({ moves }) => moves)
          .catch(() => [] as ChannelMove[]),
      ]);
      set({ channels, history });
      const where = channel === 'production' ? 'Production' : 'Staging';
      return {
        ok: true,
        detail:
          move.from === move.to
            ? `${where} already served these questions`
            : `${where} now serves ${move.to.slice(0, 12)}`,
      };
    } catch (error) {
      return {
        ok: false,
        detail:
          error instanceof ApiError
            ? error.message
            : 'publish failed — check the server log',
      };
    }
  },
}));
