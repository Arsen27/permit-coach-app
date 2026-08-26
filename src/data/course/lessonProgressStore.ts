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

// The card player saves the place on every advance and every answer, so the
// map is cached in memory (one storage read per user per app run) and the
// disk write is a trailing-edge debounce — serializing the whole map inside
// the tap handler's frame is what made cards feel laggy. Losing the window
// on a hard kill only costs one lesson's scroll position.
const WRITE_DEBOUNCE_MS = 400;

let cache: { key: string; map: PlaceMap } | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

const readAll = async (userId: string): Promise<PlaceMap> => {
  if (cache != null && cache.key === key(userId)) {
    return cache.map;
  }
  let map: PlaceMap = {};
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    map = raw == null ? {} : (JSON.parse(raw) as PlaceMap);
  } catch (error) {
    log.warn('could not read saved lesson places', error);
  }
  cache = { key: key(userId), map };
  return map;
};

const writeAll = (userId: string, map: PlaceMap): void => {
  cache = { key: key(userId), map };
  AsyncStorage.setItem(key(userId), JSON.stringify(map)).catch(error =>
    log.warn('could not save the lesson place', error),
  );
};

const scheduleWrite = (userId: string, map: PlaceMap): void => {
  cache = { key: key(userId), map };
  if (writeTimer != null) {
    clearTimeout(writeTimer);
  }
  writeTimer = setTimeout(() => {
    writeTimer = null;
    writeAll(userId, map);
  }, WRITE_DEBOUNCE_MS);
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
  const all = await readAll(userId);
  scheduleWrite(userId, { ...all, [lessonId]: place });
};

export const clearLessonPlace = async (
  userId: string,
  lessonId: string,
): Promise<void> => {
  const all = await readAll(userId);
  if (!(lessonId in all)) {
    return;
  }
  const next = { ...all };
  delete next[lessonId];
  // Immediate, not debounced: completion must not be racing a stale pending
  // snapshot of the map.
  if (writeTimer != null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  writeAll(userId, next);
};
