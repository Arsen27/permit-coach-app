import { useCallback, useEffect, useRef, useState } from 'react';

import type { CourseId } from './index';
import { InstallResult, installCourse } from './updater';

export type CourseInstallPhase =
  | 'idle'
  | 'downloading'
  | 'done'
  | 'offline'
  | 'failed'
  | 'app-update-required';

export type CourseInstall = {
  phase: CourseInstallPhase;
  // 0..1 over the documents fetched so far.
  progress: number;
  start: (courseId: CourseId) => Promise<InstallResult>;
  reset: () => void;
};

// Drives one course download for a screen: the phase its sheet shows and the
// progress, over installCourse. Never navigates or switches the active course
// itself — what happens once the course is on the device is the caller's
// decision (a state switch, or simply letting the gate lift).
export const useCourseInstall = (): CourseInstall => {
  const [phase, setPhase] = useState<CourseInstallPhase>('idle');
  const [progress, setProgress] = useState(0);

  // The download outlives a screen that navigates away on success; nothing
  // may write state into the unmounted one.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const start = useCallback(async (courseId: CourseId) => {
    setPhase('downloading');
    setProgress(0);
    const result = await installCourse({
      courseId,
      onProgress: ({ fetched, total }) => {
        if (alive.current) {
          setProgress(total === 0 ? 0 : fetched / total);
        }
      },
    });
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
