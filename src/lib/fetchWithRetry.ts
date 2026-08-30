import { createLogger } from './log';

// One request the way a phone needs it made: with a deadline, and a second
// try when the first one dies of the network rather than of the server.
//
// Mobile connections drop mid-transfer, stall on a tunnel, and come back a
// second later. A download of a hundred and fifty small files that aborts on
// the first hiccup and starts over from the top would rarely finish on a bad
// day; one retry per file turns most of those days into a slow success. What
// is never retried is an answer: a 4xx is the server's decision and stands.

const log = createLogger('net');

export type RetryOptions = {
  timeoutMs: number;
  // Attempts beyond the first. Each waits `backoffMs` × attempt.
  retries?: number;
  backoffMs?: number;
  init?: RequestInit;
};

const wait = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

// Whether a failure is worth one more try: the connection died (a thrown
// fetch), the deadline passed, or the server itself fell over. A 4xx stands.
const retryable = (failure: Response | Error): boolean =>
  failure instanceof Error || failure.status >= 500;

export const fetchWithRetry = async (
  url: string,
  { timeoutMs, retries = 1, backoffMs = 800, init }: RetryOptions,
): Promise<Response> => {
  let last: Response | Error = new Error('no attempt made');
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) {
      await wait(backoffMs * attempt);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (response.ok || !retryable(response)) {
        return response;
      }
      last = response;
      log.warn(`← ${response.status} ${url} (attempt ${attempt + 1})`);
    } catch (error) {
      last =
        error instanceof Error && error.name === 'AbortError'
          ? new Error(`timeout after ${timeoutMs}ms`)
          : error instanceof Error
          ? error
          : new Error(String(error));
      log.warn(`× ${url} (attempt ${attempt + 1}): ${last.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  if (last instanceof Error) {
    throw last;
  }
  return last;
};
