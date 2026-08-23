import React, { useEffect, useSyncExternalStore } from 'react';

import { StoredCourse, courseStore } from './store';

export const useCourse = (): StoredCourse =>
  useSyncExternalStore(courseStore.subscribe, courseStore.getSnapshot);

type CourseProviderProps = {
  children: React.ReactNode;
};

// Content is user-independent, so this mounts above AppStateProvider and
// survives its key={userId} remounts. The seed bundle serves synchronously;
// hydration swaps in the committed server version when one exists.
export const CourseProvider: React.FC<CourseProviderProps> = ({ children }) => {
  useEffect(() => {
    courseStore.hydrate().catch(() => undefined);
  }, []);

  return <>{children}</>;
};
