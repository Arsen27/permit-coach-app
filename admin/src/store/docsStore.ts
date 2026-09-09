import { create } from 'zustand';

import { adminApi } from '@admin/api/adminApi';
import type { CompetitorLesson, LessonDocV2, Outline } from '@admin/api/types';
import type { LessonCards } from '@admin/model/renderCard';
import {
  renderCardsFromCompetitor,
  renderCardsFromLessonDoc,
} from '@admin/model/renderCard';
import type { VersionDescriptor } from '@admin/model/versionDescriptor';
import { failureFor, lessonKey } from '@admin/store/loadFailure';

// Outlines and lesson documents, cached by version. Module documents are never
// fetched — they inline every lesson and run to hundreds of kilobytes.

export type LessonEntry = {
  // Absent for competitor courses: they have no wire document to play.
  doc?: LessonDocV2;
  competitor?: CompetitorLesson;
  rendered: LessonCards;
};

type DocsState = {
  outlines: Record<string, Outline>;
  lessons: Record<string, LessonEntry>;
  loading: Record<string, boolean>;
  // Why a load came back empty. A pane that simply stays blank sends whoever
  // is looking at it hunting through the server, the database and the
  // renderer — all three of which were innocent the last time this happened.
  errors: Record<string, string>;
  loadOutline: (version: VersionDescriptor) => Promise<Outline | null>;
  loadLesson: (
    version: VersionDescriptor,
    lessonId: string,
  ) => Promise<LessonEntry | null>;
  putOutline: (versionKey: string, outline: Outline) => void;
  invalidate: (versionKey: string) => void;
};

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const fetchOutline = (version: VersionDescriptor): Promise<Outline> => {
  if (version.kind === 'competitor') {
    return adminApi.competitorOutline(version.competitorId!);
  }
  if (version.kind === 'draft') {
    return adminApi.draftOutline(version.courseId!, version.draftId!);
  }
  return adminApi.releasedOutline(version.courseId!, version.version);
};

const fetchLesson = (
  version: VersionDescriptor,
  lessonId: string,
): Promise<LessonDocV2> => {
  if (version.kind === 'draft') {
    return adminApi.draftLesson(version.courseId!, version.draftId!, lessonId);
  }
  return adminApi.releasedLesson(version.courseId!, version.version, lessonId);
};

export const useDocs = create<DocsState>((set, get) => ({
  outlines: {},
  lessons: {},
  loading: {},
  errors: {},

  loadOutline: async version => {
    const cached = get().outlines[version.key];
    if (cached != null) {
      return cached;
    }
    set(state => ({ loading: { ...state.loading, [version.key]: true } }));
    try {
      const outline = await fetchOutline(version);
      set(state => ({
        outlines: { ...state.outlines, [version.key]: outline },
        loading: { ...state.loading, [version.key]: false },
      }));
      return outline;
    } catch (error) {
      set(state => ({
        loading: { ...state.loading, [version.key]: false },
        errors: { ...state.errors, [version.key]: reasonOf(error) },
      }));
      return null;
    }
  },

  loadLesson: async (version, lessonId) => {
    const key = lessonKey(version.key, lessonId);
    const cached = get().lessons[key];
    if (cached != null) {
      return cached;
    }
    set(state => ({ loading: { ...state.loading, [key]: true } }));
    try {
      let entry: LessonEntry;
      if (version.kind === 'competitor') {
        const lesson = await adminApi.competitorLesson(
          version.competitorId!,
          lessonId,
        );
        entry = {
          competitor: lesson,
          rendered: renderCardsFromCompetitor(lesson),
        };
      } else {
        const doc = await fetchLesson(version, lessonId);
        const outline = get().outlines[version.key];
        entry = {
          doc,
          rendered: renderCardsFromLessonDoc(
            doc,
            outline?.state ?? 'State',
            outline?.cardStyles,
          ),
        };
      }
      set(state => ({
        lessons: { ...state.lessons, [key]: entry },
        loading: { ...state.loading, [key]: false },
      }));
      return entry;
    } catch (error) {
      set(state => ({
        loading: { ...state.loading, [key]: false },
        errors: { ...state.errors, [key]: reasonOf(error) },
      }));
      return null;
    }
  },

  putOutline: (versionKey, outline) =>
    set(state => ({ outlines: { ...state.outlines, [versionKey]: outline } })),

  // Called after an edit: the version's cached documents are stale.
  invalidate: versionKey =>
    set(state => ({
      outlines: Object.fromEntries(
        Object.entries(state.outlines).filter(([key]) => key !== versionKey),
      ),
      lessons: Object.fromEntries(
        Object.entries(state.lessons).filter(
          ([key]) => !key.startsWith(`${versionKey}/`),
        ),
      ),
    })),
}));

// The reason the pane is empty, when there is one; see loadFailure.ts.
export const selectLoadFailure = (
  state: DocsState,
  versionKey: string | null,
  lessonId: string | null,
): string | null => failureFor(state.errors, versionKey, lessonId);

export const selectLesson = (
  state: DocsState,
  versionKey: string | null,
  lessonId: string | null,
): LessonEntry | undefined =>
  versionKey == null || lessonId == null
    ? undefined
    : state.lessons[lessonKey(versionKey, lessonId)];

export const selectOutline = (
  state: DocsState,
  versionKey: string | null,
): Outline | undefined =>
  versionKey == null ? undefined : state.outlines[versionKey];
