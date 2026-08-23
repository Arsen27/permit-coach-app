import {
  analyticsEnabled,
  posthog,
  requestAccountErasure,
  track,
  trackError,
} from '@/analytics';
import { captureCurrentScreen } from '@/analytics/screens';
import { SERVER_URL } from '@/lib/serverConfig';

// The contract every call site relies on: with analytics off — no project key,
// a dev build, or this jest runtime — reporting is a silent no-op rather than a
// crash or a network call. Screens call track() from render paths, so a
// regression here would break the app, not just the analytics.

describe('analytics gating', () => {
  it('creates no client under jest, whatever the config says', () => {
    expect(analyticsEnabled).toBe(false);
    expect(posthog).toBeNull();
  });

  it('accepts events without a client', () => {
    expect(() => track('onboarding_started')).not.toThrow();
    expect(() =>
      track('quiz_completed', {
        mode: 'exam',
        correct: 30,
        question_count: 36,
        percent: 83,
        passed: true,
        timed_out: false,
      }),
    ).not.toThrow();
    expect(() =>
      trackError(new Error('nope'), { where: 'test' }),
    ).not.toThrow();
  });

  it('captures no screen before the navigator is ready', () => {
    expect(() => captureCurrentScreen()).not.toThrow();
  });
});

// Account deletion asks the server to erase the learner's PostHog person; the
// app only carries the access token that proves whose person it is.
describe('analytics erasure', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('posts to the server with the access token as the only credential', async () => {
    const fetchMock = jest.fn(() => Promise.resolve({ ok: true } as Response));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(requestAccountErasure('jwt-token')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(`${SERVER_URL}/v1/account/erasure`, {
      method: 'POST',
      headers: { Authorization: 'Bearer jwt-token' },
    });
  });

  // Reported, never thrown: a failure here must not stop the account deletion
  // the learner asked for.
  it('reports a rejected erasure without throwing', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 502 } as Response),
    ) as unknown as typeof fetch;

    await expect(requestAccountErasure('jwt-token')).resolves.toBe(false);
  });

  it('reports a network failure without throwing', async () => {
    global.fetch = jest.fn(() =>
      Promise.reject(new Error('offline')),
    ) as unknown as typeof fetch;

    await expect(requestAccountErasure('jwt-token')).resolves.toBe(false);
  });
});
