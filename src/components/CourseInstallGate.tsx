import React, { useCallback, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { track } from '@/analytics';
import { CourseInstallView } from '@/components/CourseInstallSheet';
import { Sheet } from '@/components/resultSheet';
import { courseIdForState } from '@/data/course';
import { courseStore } from '@/data/course/store';
import { useCourseInstall } from '@/data/course/useCourseInstall';
import { findState } from '@/data/states';
import { setContentChannel, useContentChannel } from '@/lib/contentChannel';
import { useAppState } from '@/state/AppState';

// Full-screen stop for an onboarded device that holds no course for its
// state: an install from before the app went server-only, a store that
// failed to hydrate, or a state that arrived through profile sync. Downloads
// on mount; the moment the course commits, the store serves it and App.tsx
// swaps the real shell in. There is nothing to cancel into — without a course
// there is no app — so the only way out is a successful download.
//
// One exception, in development only. Switching to the staging channel wipes
// the installed course, so a channel that then refuses to answer strands the
// device here, retrying against the same channel forever, with the switch
// that would undo it locked behind this screen. That way out is offered here.
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

  // The hook, not the getter: this screen is mounted alone, so nothing else
  // has read the stored channel off the disk yet, and the getter would answer
  // 'production' for a device that is very much on staging.
  const channel = useContentChannel();
  const stranded = __DEV__ && channel === 'staging';
  const leaveStaging = useCallback(async () => {
    await setContentChannel('production', courseStore.wipeDownloadedContent);
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
        {...(stranded && {
          onCancel: () => void leaveStaging(),
          cancelLabel: 'Leave the staging channel',
        })}
      />
    </Sheet>
  );
};

export default CourseInstallGate;
