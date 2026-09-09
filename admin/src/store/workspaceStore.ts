import { create } from 'zustand';

import { adminApi } from '@admin/api/adminApi';
import type {
  AdminSettings,
  ChannelPointers,
  LlmProvider,
  Workspace,
} from '@admin/api/types';
import type { VersionDescriptor } from '@admin/model/versionDescriptor';
import {
  competitorKey,
  describeDraft,
  describeReleased,
} from '@admin/model/versionDescriptor';
import { selectOutline, useDocs } from './docsStore';
import { useSelection } from './selectionStore';

// Which courses exist, which versions each has, and the workspace preferences.
// Everything selection-related lives in selectionStore so that reloading the
// version list does not disturb what the user is looking at.

type WorkspaceState = {
  ready: boolean;
  error: string | null;
  courses: Workspace['courses'];
  providers: LlmProvider[];
  settings: AdminSettings | null;
  courseId: string | null;
  versions: VersionDescriptor[];
  // What staging and production serve for the selected course.
  channels: ChannelPointers | null;
  competitors: VersionDescriptor[];
  load: () => Promise<void>;
  // Re-reads the course list (and its channel pointers) without touching
  // the selection.
  refreshCourses: () => Promise<void>;
  selectCourse: (courseId: string) => Promise<void>;
  reloadVersions: () => Promise<VersionDescriptor[]>;
  saveSettings: (patch: Partial<AdminSettings>) => Promise<void>;
};

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  ready: false,
  error: null,
  courses: [],
  providers: [],
  settings: null,
  courseId: null,
  versions: [],
  channels: null,
  competitors: [],

  refreshCourses: async () => {
    const workspace = await adminApi.workspace();
    set({
      courses: workspace.courses,
      settings: workspace.settings,
      providers: workspace.llm.providers,
    });
  },

  load: async () => {
    try {
      const workspace = await adminApi.workspace();
      const preferred =
        workspace.courses.find(
          course => course.usState === workspace.settings.defaultState,
        ) ?? workspace.courses[0];
      // Competitor courses are the same for every state, so they load once.
      const competitors = await adminApi
        .competitors()
        .then(response =>
          response.courses.map(course => ({
            key: competitorKey(course.id),
            kind: 'competitor' as const,
            competitorId: course.id,
            label: course.name,
            name: course.name,
            version: course.name,
            format: course.format,
            date: `${course.modules} modules · ${course.lessons} lessons`,
            editable: false,
          })),
        )
        .catch(() => []);

      set({
        courses: workspace.courses,
        settings: workspace.settings,
        providers: workspace.llm.providers,
        competitors,
        error: null,
      });
      if (preferred != null) {
        await get().selectCourse(preferred.courseId);
      } else {
        set({ ready: true });
      }
    } catch (error) {
      set({ error: (error as Error).message, ready: true });
    }
  },

  selectCourse: async courseId => {
    // Where the operator is right now: which version, and the lesson's
    // position (module and row) rather than its id — ids are per-state.
    const selection = useSelection.getState();
    const previousVersion = [...get().versions, ...get().competitors].find(
      item => item.key === selection.selectedKey,
    );
    const previousOutline = selectOutline(
      useDocs.getState(),
      selection.selectedKey,
    );
    const findPosition = (): { module: number; lesson: number } | null => {
      if (previousOutline == null || selection.lessonId == null) {
        return null;
      }
      for (const [moduleIndex, module] of previousOutline.modules.entries()) {
        const lessonIndex = module.lessons.findIndex(
          lesson => lesson.lessonId === selection.lessonId,
        );
        if (lessonIndex >= 0) {
          return { module: moduleIndex, lesson: lessonIndex };
        }
      }
      return null;
    };
    const position = findPosition();

    set({ courseId, ready: false });
    const versions = await get().reloadVersions();

    // Same version number in the new state when it exists, else the newest.
    const target =
      (previousVersion == null
        ? undefined
        : versions.find(
            item =>
              item.kind === previousVersion.kind &&
              item.version === previousVersion.version,
          ) ??
          versions.find(item => item.version === previousVersion.version)) ??
      versions[0] ??
      null;

    if (target != null) {
      const outline = await useDocs.getState().loadOutline(target);
      const modules = outline?.modules ?? [];
      const samePlace =
        position == null
          ? undefined
          : modules[position.module]?.lessons[position.lesson]?.lessonId;
      const mappedLesson =
        samePlace ??
        modules.flatMap(module => module.lessons)[0]?.lessonId ??
        null;

      // A competitor reference is state-agnostic and survives as is; a
      // reference into our own course follows the version number over.
      const compareKey = selection.compareKey;
      let mappedCompare: string | null = null;
      if (compareKey != null) {
        if (compareKey.startsWith('comp:')) {
          mappedCompare = compareKey;
        } else {
          const refVersion = compareKey.split(':')[2];
          mappedCompare =
            versions.find(
              item => item.version === refVersion && item.key !== target.key,
            )?.key ?? null;
        }
      }

      useSelection.getState().remapCourse({
        versionKey: target.key,
        lessonId: mappedLesson,
        compareKey: mappedCompare,
      });
    }

    set({ ready: true });
  },

  reloadVersions: async () => {
    const courseId = get().courseId;
    if (courseId == null) {
      return [];
    }
    const response = await adminApi.versions(courseId);
    // Drafts first, newest release next — the sidebar reads top-down.
    const versions = [
      ...response.drafts.map(describeDraft),
      ...response.released.map(entry => describeReleased(courseId, entry)),
    ];
    set({ versions, channels: response.channels });
    return versions;
  },

  saveSettings: async patch => {
    const settings = await adminApi.saveSettings(patch);
    set({ settings });
  },
}));

export const stateOfCourse = (
  courses: Workspace['courses'],
  courseId: string | null,
): string =>
  courses.find(course => course.courseId === courseId)?.usState ?? '';
