import type { LessonAnswer } from '@/components/lesson/types';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { createLogger } from '@/lib/log';

// Where the learner stopped inside a lesson. The card player promises "we'll
// save your place and bring you right back here" when leaving mid-lesson, so
// the position and the answers given so far are persisted per user per
// lesson and cleared once the lesson is completed.
//
// This is presentation state, not progress: it never syncs to Supabase, and
// losing it only costs the learner their scroll position in one lesson.

const key = (userId: string) => `dmv-prep/lesson-place/v2/${userId}`;

const log = createLogger('lesson');

// Defined with the shared card renderer so the presentational module stays
// free of this file's storage imports; re-exported here for existing callers.
export type { LessonAnswer } from '@/components/lesson/types';

export type LessonPlace = {
  cardIndex: number;
  answers: Record<string, LessonAnswer>;
};

type PlaceMap = Record<string, LessonPlace>;

const readAll = async (userId: string): Promise<PlaceMap> => {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw == null ? {} : (JSON.parse(raw) as PlaceMap);
  } catch (error) {
    log.warn('could not read saved lesson places', error);
    return {};
  }
};

export const loadLessonPlace = async (
  userId: string,
  lessonId: string,
): Promise<LessonPlace | null> => (await readAll(userId))[lessonId] ?? null;

export const saveLessonPlace = async (
  userId: string,
  lessonId: string,
  place: LessonPlace,
): Promise<void> => {
  try {
    const all = await readAll(userId);
    await AsyncStorage.setItem(
      key(userId),
      JSON.stringify({ ...all, [lessonId]: place }),
    );
  } catch (error) {
    log.warn('could not save the lesson place', error);
  }
};

export const clearLessonPlace = async (
  userId: string,
  lessonId: string,
): Promise<void> => {
  try {
    const all = await readAll(userId);
    if (!(lessonId in all)) {
      return;
    }
    delete all[lessonId];
    await AsyncStorage.setItem(key(userId), JSON.stringify(all));
  } catch (error) {
    log.warn('could not clear the lesson place', error);
  }
};
