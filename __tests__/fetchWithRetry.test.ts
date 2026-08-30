import { fetchWithRetry } from '@/lib/fetchWithRetry';

// One request the way a phone needs it made: a deadline, and a second try
// when the first died of the network. A server's own answer is never retried.

const response = (status: number) =>
  ({ ok: status >= 200 && status < 300, status } as Response);

let fetchMock: jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  fetchMock = jest.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
});

const settle = async () => {
  // Drains the backoff timer and the promise chain behind it.
  await Promise.resolve();
  jest.advanceTimersByTime(5000);
  await Promise.resolve();
};

it('returns the first answer when it is fine', async () => {
  fetchMock.mockResolvedValueOnce(response(200));
  await expect(
    fetchWithRetry('http://x/doc', { timeoutMs: 1000 }),
  ).resolves.toMatchObject({ status: 200 });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('tries once more when the connection dies, and succeeds', async () => {
  fetchMock
    .mockRejectedValueOnce(new TypeError('Network request failed'))
    .mockResolvedValueOnce(response(200));
  const request = fetchWithRetry('http://x/doc', { timeoutMs: 1000 });
  await settle();
  await expect(request).resolves.toMatchObject({ status: 200 });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('tries once more after a server error', async () => {
  fetchMock
    .mockResolvedValueOnce(response(503))
    .mockResolvedValueOnce(response(200));
  const request = fetchWithRetry('http://x/doc', { timeoutMs: 1000 });
  await settle();
  await expect(request).resolves.toMatchObject({ status: 200 });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("never retries the server's own decision", async () => {
  fetchMock.mockResolvedValueOnce(response(404));
  await expect(
    fetchWithRetry('http://x/doc', { timeoutMs: 1000 }),
  ).resolves.toMatchObject({ status: 404 });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('gives up with the last failure after the retries are spent', async () => {
  fetchMock.mockRejectedValue(new TypeError('Network request failed'));
  const request = fetchWithRetry('http://x/doc', { timeoutMs: 1000 });
  const outcome = request.catch(error => error);
  await settle();
  await expect(outcome).resolves.toBeInstanceOf(Error);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('aborts a request that hangs past its deadline', async () => {
  // The first attempt never answers; the deadline aborts it, the second
  // attempt answers at once.
  fetchMock
    .mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    )
    .mockResolvedValueOnce(response(200));
  const request = fetchWithRetry('http://x/doc', { timeoutMs: 1000 });
  jest.advanceTimersByTime(1000);
  await settle();
  await expect(request).resolves.toMatchObject({ status: 200 });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
