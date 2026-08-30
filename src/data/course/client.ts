import {
  ContentChannel,
  getContentChannel,
  getStagingKey,
} from '@/lib/contentChannel';
import { createLogger, formatBytes } from '@/lib/log';
import { APP_VERSION, SERVER_URL } from '@/lib/serverConfig';

const TIMEOUT_MS = 8000;

const log = createLogger('net');

// Returns the exact response body: document endpoints are hash-verified
// against the manifest before parsing, so nothing here may re-serialize.
// The staging channel and the versions only it serves are behind a key the
// developer enters once; in a release build there is never one to send.
const stagingHeaders = (): Record<string, string> => {
  const key = getStagingKey();
  return key.length > 0 ? { 'X-Staging-Key': key } : {};
};

const requestRaw = async (path: string): Promise<string> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const elapsed = log.time();
  log.info(`→ GET ${path}`);
  try {
    const response = await fetch(`${SERVER_URL}${path}`, {
      signal: controller.signal,
      headers: stagingHeaders(),
    });
    if (!response.ok) {
      log.warn(`← ${response.status} ${path} (${elapsed()}ms)`);
      throw new Error(
        `content server responded ${response.status} for ${path}`,
      );
    }
    const body = await response.text();
    log.info(
      `← ${response.status} ${path} (${elapsed()}ms, ${formatBytes(
        body.length,
      )})`,
    );
    return body;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      log.error(`× timeout after ${TIMEOUT_MS}ms ${path}`);
    } else if (error instanceof Error && !error.message.includes('responded')) {
      log.error(`× ${path} (${elapsed()}ms)`, error.message);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

// Bootstrap is parsed here but validated by the updater
// (validateBootstrapResponseV2) before anything acts on it.
//
// `courseVersion` is null when the device holds no version of the course at
// all (a first download); the server then answers mode 'full' with its latest
// release instead of trying to diff against nothing.
export const fetchBootstrapRaw = (
  courseId: string,
  courseVersion: string | null,
  appVersion: string,
): Promise<string> =>
  requestRaw(
    `/v1/bootstrap?course=${courseId}&channel=${getContentChannel()}${
      courseVersion == null ? '' : `&courseVersion=${courseVersion}`
    }&appVersion=${appVersion}`,
  );

// Does a channel answer, for this key? Asked before a dev build switches
// channels, because switching throws the installed course away first: a key
// with one character missing would otherwise leave the phone with no course
// at all, and the only screen that could put the channel back sits behind the
// course it no longer has.
export const channelAnswers = async (
  courseId: string,
  channel: ContentChannel,
  key: string,
): Promise<boolean> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const path = `/v1/bootstrap?course=${courseId}&channel=${channel}&appVersion=${APP_VERSION}`;
  try {
    const response = await fetch(`${SERVER_URL}${path}`, {
      signal: controller.signal,
      headers: key.length > 0 ? { 'X-Staging-Key': key } : {},
    });
    log.info(`← ${response.status} ${path} (channel probe)`);
    return response.ok;
  } catch (error) {
    log.error(
      `× channel probe ${channel}`,
      error instanceof Error ? error.message : String(error),
    );
    return false;
  } finally {
    clearTimeout(timer);
  }
};

export const fetchCourseDocRaw = (
  courseId: string,
  semver: string,
): Promise<string> => requestRaw(`/v1/course/${courseId}/${semver}/course`);

export const fetchModuleDocRaw = (
  courseId: string,
  semver: string,
  moduleId: string,
): Promise<string> =>
  requestRaw(`/v1/course/${courseId}/${semver}/modules/${moduleId}`);

export const fetchLessonDocRaw = (
  courseId: string,
  semver: string,
  lessonId: string,
): Promise<string> =>
  requestRaw(`/v1/course/${courseId}/${semver}/lessons/${lessonId}`);
