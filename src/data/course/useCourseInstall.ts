import { useCallback, useEffect, useRef, useState } from 'react';

import type { CourseId } from './index';
import { syncLazyCourse } from './lazy';

// One first download for a screen: under the lazy model that is the outline
// and the bank — a few dozen kilobytes — after which the course stands and
// every lesson fetches itself when opened.

export type InstallStatus =
  | 'installed'
  | 'offline'
  | 'failed'
  | 'app-update-required';
export type InstallResult = { status: InstallStatus };

export type CourseInstallPhase =
  | 'idle'
  | 'downloading'
  | 'done'
  | 'offline'
  | 'failed'
  | 'app-update-required';

export type CourseInstall = {
  phase: CourseInstallPhase;
  progress: number;
  start: (courseId: CourseId) => Promise<InstallResult>;
  reset: () => void;
};

// The sync itself, callable from anywhere a screen is not — onboarding's
// Building step drives it directly.
export const installCourse = async (
  courseId: CourseId,
): Promise<InstallResult> => {
  const result = await syncLazyCourse({
    courseId,
    // A first download has no learner yet: nothing is completed, nothing can
    // be marked.
    userId: 'install',
    completedLessonIds: [],
  });
  return {
    status:
      result.status === 'ready'
        ? 'installed'
        : result.status === 'offline'
        ? 'offline'
        : result.status === 'app-update-required'
        ? 'app-update-required'
        : 'failed',
  };
};

export const useCourseInstall = (): CourseInstall => {
  const [phase, setPhase] = useState<CourseInstallPhase>('idle');
  const [progress, setProgress] = useState(0);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const start = useCallback(async (courseId: CourseId) => {
    setPhase('downloading');
    setProgress(0.2);
    const result = await installCourse(courseId);
    if (alive.current) {
      if (result.status === 'installed') {
        setProgress(1);
        setPhase('done');
      } else {
        setPhase(result.status);
      }
    }
    return result;
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setProgress(0);
  }, []);

  return { phase, progress, start, reset };
};
