import { fetchBootstrapRaw, fetchModuleDocRaw } from '@/data/course/client';
import { resetContentChannelForTests } from '@/lib/contentChannel';

// The client on a phone: a request that dies of the network gets a second
// try; the server's own answer stands; nothing is ever re-serialised.

jest.mock('@/lib/serverConfig', () => ({
  SERVER_URL: 'http://test',
  isServerConfigured: true,
  APP_VERSION: '1.0.0',
}));

let fetchMock: jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  resetContentChannelForTests();
  fetchMock = jest.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
});

const answer = (status: number, body = '') =>
  ({ ok: status < 300, status, text: async () => body } as Response);

const settle = async () => {
  await Promise.resolve();
  jest.advanceTimersByTime(5000);
  await Promise.resolve();
  await Promise.resolve();
};

it('hands back the exact body a document came with', async () => {
  fetchMock.mockResolvedValueOnce(answer(200, '{"a": 1}\n'));
  await expect(
    fetchModuleDocRaw('ca-class-c', '1.0.0', 'ca-mod'),
  ).resolves.toBe('{"a": 1}\n');
  expect(fetchMock.mock.calls[0][0]).toBe(
    'http://test/v1/course/ca-class-c/1.0.0/modules/ca-mod',
  );
});

it('a document whose connection dropped is asked for once more', async () => {
  fetchMock
    .mockRejectedValueOnce(new TypeError('Network request failed'))
    .mockResolvedValueOnce(answer(200, 'doc'));
  const request = fetchModuleDocRaw('ca-class-c', '1.0.0', 'ca-mod');
  await settle();
  await expect(request).resolves.toBe('doc');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('a server that fell over is asked once more; a missing document is not', async () => {
  fetchMock
    .mockResolvedValueOnce(answer(502))
    .mockResolvedValueOnce(answer(200, 'doc'));
  const recovered = fetchModuleDocRaw('ca-class-c', '1.0.0', 'ca-mod');
  await settle();
  await expect(recovered).resolves.toBe('doc');

  fetchMock.mockReset();
  fetchMock.mockResolvedValueOnce(answer(404));
  await expect(
    fetchModuleDocRaw('ca-class-c', '1.0.0', 'gone'),
  ).rejects.toThrow('responded 404');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('a bootstrap the network swallowed twice is reported, not retried forever', async () => {
  fetchMock.mockRejectedValue(new TypeError('Network request failed'));
  const request = fetchBootstrapRaw('ca-class-c', '1.0.0', '1.0.0');
  const outcome = request.catch(error => error);
  await settle();
  await expect(outcome).resolves.toBeInstanceOf(Error);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
