import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { ensureLesson, lessonLoaded } from './lazy';
import { courseStore } from './store';

// The body of one lesson, made present before its screen shows content. A
// lesson already on the device answers instantly and costs nothing; anything
// else is one download, after which it is on the device for good. No
// connection gets the standard alert with a retry — the lesson screens have
// nothing to show without their lesson.

export type LessonBodyStatus = 'ready' | 'loading' | 'offline' | 'failed';

export const useLessonBody = (
  lessonId: string,
  onGiveUp?: () => void,
): { status: LessonBodyStatus; retry: () => void } => {
  const courseId = courseStore.activeCourseId();
  const [status, setStatus] = useState<LessonBodyStatus>(() =>
    lessonLoaded(courseId, lessonId) ? 'ready' : 'loading',
  );

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const attempt = useCallback(() => {
    if (lessonLoaded(courseId, lessonId)) {
      setStatus('ready');
      return;
    }
    setStatus('loading');
    ensureLesson(courseId, lessonId).then(outcome => {
      if (!alive.current) {
        return;
      }
      setStatus(outcome === 'ready' ? 'ready' : outcome);
    });
  }, [courseId, lessonId]);

  useEffect(() => {
    attempt();
  }, [attempt]);

  // The standard no-connection alert, once per failure: the learner retries
  // or walks back to the list. A server-side failure reads the same way — to
  // the person holding the phone the difference does not exist.
  const warned = useRef<LessonBodyStatus | null>(null);
  useEffect(() => {
    if (status !== 'offline' && status !== 'failed') {
      warned.current = null;
      return;
    }
    if (warned.current === status) {
      return;
    }
    warned.current = status;
    Alert.alert(
      'No Connection',
      'This lesson needs an internet connection the first time you open it. Once downloaded, it stays on your phone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: onGiveUp },
        { text: 'Try Again', onPress: attempt },
      ],
    );
  }, [status, attempt, onGiveUp]);

  return { status, retry: attempt };
};
