import { clearAssets } from '@/data/assets/store';

import { CourseId, DEFAULT_COURSE_ID } from './index';
import {
  hydrateLazyCourse,
  lazyHydrated,
  lazySnapshot,
  resetLazyForTests,
  subscribeLazy,
  wipeLazy,
} from './lazy';
import type { CourseBundleV2 } from './v2/wire';

// The face every screen reads the course through. Behind it sits the lazy
// store: the outline and the bank make the course, lesson bodies join as they
// are opened. This module only remembers which course is active — the
// learner's state decides that — and answers for it.

export type StoredCourse = {
  deliveryVersion: string;
  bundle: CourseBundleV2;
};

let activeCourseId: CourseId = DEFAULT_COURSE_ID;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

export const courseStore = {
  activeCourseId: (): CourseId => activeCourseId,
  getSnapshot: (): StoredCourse | null => lazySnapshot(activeCourseId),
  isHydrated: (): boolean => lazyHydrated(activeCourseId),
  hydrate: (): Promise<void> => hydrateLazyCourse(activeCourseId),
  // Hydrates a specific course (active or not) and answers what is on the
  // device for it — what a state switch asks before deciding to download.
  hydrateCourse: async (courseId: CourseId): Promise<StoredCourse | null> => {
    await hydrateLazyCourse(courseId);
    return lazySnapshot(courseId);
  },
  // Switches which course the store serves (the learner changed state).
  setActiveCourse: (courseId: CourseId): void => {
    if (courseId === activeCourseId) {
      return;
    }
    activeCourseId = courseId;
    notify();
    hydrateLazyCourse(courseId).catch(() => undefined);
  },
  // Forgets every downloaded course and picture, leaving the device as empty
  // as a fresh install. The dev channel switch calls it; the caller syncs the
  // new channel's course afterwards.
  wipeDownloadedContent: async (): Promise<void> => {
    await clearAssets();
    await wipeLazy();
    notify();
  },
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    const unsubscribe = subscribeLazy(listener);
    return () => {
      listeners.delete(listener);
      unsubscribe();
    };
  },
  // Test seam: back to a device with nothing on it.
  resetForTests: (): void => {
    activeCourseId = DEFAULT_COURSE_ID;
    listeners.clear();
    resetLazyForTests();
  },
};
