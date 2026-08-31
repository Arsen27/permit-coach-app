import { useEffect, useSyncExternalStore } from 'react';

import { marksSnapshot, readMarks, subscribeLazy } from './lazy';
import type { YellowMarks } from './lazy';
import { courseStore } from './store';

// The lessons this learner should re-take, live: the ladder paints them
// yellow, the player tints their changed blocks, and completing one again
// clears it — all through the same store the sync writes.
export const useYellowMarks = (userId: string): YellowMarks => {
  const courseId = courseStore.activeCourseId();
  useEffect(() => {
    // Fills the cache from disk once; the snapshot below answers from it.
    void readMarks(userId, courseId);
  }, [userId, courseId]);
  return useSyncExternalStore(subscribeLazy, () =>
    marksSnapshot(userId, courseId),
  );
};
