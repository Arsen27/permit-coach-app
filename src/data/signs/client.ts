import { getContentChannel, getStagingKey } from '@/lib/contentChannel';
import { createLogger, formatBytes } from '@/lib/log';
import { SERVER_URL } from '@/lib/serverConfig';

// Raw HTTP for the signs catalogue: the document body is hash-verified
// against /v1/signs/latest before parsing, so nothing here may re-serialize —
// callers get the exact response text.

const TIMEOUT_MS = 8000;

const log = createLogger('net');

const requestRaw = async (path: string): Promise<string> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const elapsed = log.time();
  log.info(`→ GET ${path}`);
  try {
    const key = getStagingKey();
    const response = await fetch(`${SERVER_URL}${path}`, {
      signal: controller.signal,
      headers: key.length > 0 ? { 'X-Staging-Key': key } : {},
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

// The channel rides along even though the catalogue is not versioned yet:
// the server ignores it until the signs move into the content database.
export const fetchSignsLatestRaw = (): Promise<string> =>
  requestRaw(`/v1/signs/latest?channel=${getContentChannel()}`);

export const fetchSignsDocRaw = (): Promise<string> =>
  requestRaw(`/v1/signs/doc?channel=${getContentChannel()}`);

// Assets are content-addressed, so this URL never changes for a given picture
// and the platform image cache can hold it indefinitely.
export const signAssetUrl = (assetId: string, extension: string): string =>
  `${SERVER_URL}/v1/signs/assets/${assetId}.${extension}`;
