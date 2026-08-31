import React, { useEffect, useSyncExternalStore } from 'react';

import { hydrateAssets, warmAssets } from '@/data/assets/store';
import { signsArtwork } from '@/data/signs/store';

import { StoredCourse, courseStore } from './store';

// The committed course for the active state — null before hydration and when
// nothing has been downloaded for it yet.
export const useStoredCourse = (): StoredCourse | null =>
  useSyncExternalStore(courseStore.subscribe, courseStore.getSnapshot);

// Whether the store has answered for the active state yet. A null course is
// only meaningful once this is true.
export const useCourseHydrated = (): boolean =>
  useSyncExternalStore(courseStore.subscribe, courseStore.isHydrated);

// The active course, for screens that only exist once one is on the device
// (everything under the course gate in App.tsx). Rendering one of them with
// no course is a programming error, not a state to handle.
export const useCourse = (): StoredCourse => {
  const course = useStoredCourse();
  if (course == null) {
    throw new Error(
      'useCourse: no course committed for the active state — render this screen under the course gate',
    );
  }
  return course;
};

type CourseProviderProps = {
  children: React.ReactNode;
};

// Content is user-independent, so this mounts above AppStateProvider and
// survives its key={userId} remounts. Kicks off hydration of the default
// course; AppState re-points the store at the learner's state as soon as its
// own snapshot loads.
export const CourseProvider: React.FC<CourseProviderProps> = ({ children }) => {
  const course = useStoredCourse();

  useEffect(() => {
    courseStore.hydrate().catch(() => undefined);
    // Where pictures live, and which ones are here, before the first card
    // renders.
    hydrateAssets().catch(() => undefined);
  }, []);

  // The pictures this course shows, read into memory as soon as the course
  // itself is known — and again when a state switch brings another one. A
  // card that waited for its own read drew a placeholder first and the
  // illustration a moment later; there is nothing to wait for now.
  useEffect(() => {
    if (course == null) {
      return;
    }
    warmAssets([
      ...course.bundle.assets.map(asset => asset.sha256),
      ...signsArtwork().map(asset => asset.sha256),
    ]).catch(() => undefined);
  }, [course]);

  return <>{children}</>;
};
