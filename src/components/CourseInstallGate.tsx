import React, { useCallback, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { track } from '@/analytics';
import { CourseInstallView } from '@/components/CourseInstallSheet';
import { Sheet } from '@/components/resultSheet';
import { courseIdForState } from '@/data/course';
import { useCourseInstall } from '@/data/course/useCourseInstall';
import { findState } from '@/data/states';
import { useAppState } from '@/state/AppState';

// Full-screen stop for an onboarded device that holds no course for its
// state: an install from before the app went server-only, a store that
// failed to hydrate, or a state that arrived through profile sync. Downloads
// on mount; the moment the course commits, the store serves it and App.tsx
// swaps the real shell in. There is nothing to cancel into — without a course
// there is no app — so the only way out is a successful download.
const CourseInstallGate: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAppState();
  const { phase, progress, start } = useCourseInstall();
  const courseId = courseIdForState(user.stateCode);
  const stateName = findState(user.stateCode).name;

  const run = useCallback(() => {
    const startedAt = Date.now();
    start(courseId).then(result => {
      track('course_download_finished', {
        source: 'recovery',
        outcome:
          result.status === 'installed'
            ? 'ok'
            : result.status === 'app-update-required'
            ? 'app_update_required'
            : result.status,
        duration_ms: Date.now() - startedAt,
      });
    });
  }, [courseId, start]);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <Sheet
      style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
    >
      <CourseInstallView
        phase={phase === 'idle' ? 'downloading' : phase}
        progress={progress}
        stateName={stateName}
        onRetry={run}
      />
    </Sheet>
  );
};

export default CourseInstallGate;
