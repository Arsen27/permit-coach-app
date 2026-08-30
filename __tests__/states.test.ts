import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  SUPPORTED_STATES_FALLBACK,
  courseIdForStateCode,
  findState,
  loadStates,
  resetStatesForTests,
  retryStates,
  statesSnapshot,
} from '@/data/states';

// Which states the app offers is the server's list now: a state added there
// is selectable on every phone at its next launch, with no App Store release.
// The phone keeps the last answer, and says so when it is showing one.

jest.mock('@/lib/serverConfig', () => ({
  SERVER_URL: 'http://test',
  isServerConfigured: true,
  APP_VERSION: '1.0.0',
}));

const CACHE_KEY = 'dmv-prep/states/v1';

const payload = (
  states: {
    stateCode: string;
    name: string;
    courseId: string;
    domain: string;
  }[],
) => JSON.stringify({ states });

const NY = {
  stateCode: 'NY',
  name: 'New York',
  courseId: 'ny-class-d',
  domain: 'dmv.ny.gov',
};
const CA = {
  stateCode: 'CA',
  name: 'California',
  courseId: 'ca-class-c',
  domain: 'dmv.ca.gov',
};

let fetchMock: jest.Mock;

beforeEach(async () => {
  await AsyncStorage.clear();
  resetStatesForTests();
  fetchMock = jest.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

const answers = (body: string) =>
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => body,
  } as Response);

const dead = () =>
  fetchMock.mockRejectedValue(new TypeError('Network request failed'));

it('a state added on the server is offered without a new build', async () => {
  answers(payload([CA, NY]));
  await loadStates();

  const { states, source, offline } = statesSnapshot();
  expect(states.map(state => state.code)).toEqual(['CA', 'NY']);
  expect(source).toBe('server');
  expect(offline).toBe(false);
  // And the course it studies is the one the server named — an id this build
  // has never seen.
  expect(courseIdForStateCode('NY')).toBe('ny-class-d');
  expect(findState('NY').domain).toBe('dmv.ny.gov');
});

it('remembers the answer, so a later launch offline still offers it', async () => {
  answers(payload([CA, NY]));
  await loadStates();
  expect(await AsyncStorage.getItem(CACHE_KEY)).toContain('ny-class-d');

  // Next launch: no network at all.
  resetStatesForTests();
  dead();
  await loadStates();
  const { states, source, offline } = statesSnapshot();
  expect(states.map(state => state.code)).toEqual(['CA', 'NY']);
  expect(source).toBe('cache');
  expect(offline).toBe(true);
});

it('a first launch with no network falls back to what the binary carries, and says it is offline', async () => {
  dead();
  await loadStates();
  const { states, source, offline } = statesSnapshot();
  expect(states).toEqual(SUPPORTED_STATES_FALLBACK);
  expect(source).toBe('fallback');
  expect(offline).toBe(true);
});

it('a retry after the connection returns takes the real list', async () => {
  dead();
  await loadStates();
  expect(statesSnapshot().offline).toBe(true);

  answers(payload([CA, NY]));
  await retryStates();
  expect(statesSnapshot().source).toBe('server');
  expect(statesSnapshot().offline).toBe(false);
  expect(statesSnapshot().states.map(state => state.code)).toEqual([
    'CA',
    'NY',
  ]);
});

it('a row the app could not render is dropped, not shown half-empty', async () => {
  answers(
    payload([CA, { ...NY, domain: '' }, { ...NY, stateCode: 'nyc' }] as never),
  );
  await loadStates();
  expect(statesSnapshot().states.map(state => state.code)).toEqual(['CA']);
});

it('an answer with nothing usable in it leaves the last good list alone', async () => {
  answers(payload([CA, NY]));
  await loadStates();

  resetStatesForTests();
  await AsyncStorage.setItem(CACHE_KEY, payload([CA, NY]));
  answers(JSON.stringify({ states: [] }));
  await loadStates();
  const { states, source, offline } = statesSnapshot();
  expect(states.map(state => state.code)).toEqual(['CA', 'NY']);
  expect(source).toBe('cache');
  expect(offline).toBe(true);
});

it('a state the phone has never heard of still resolves to a course', async () => {
  dead();
  await loadStates();
  // A stored state code from a build with a bigger catalogue.
  expect(courseIdForStateCode('WA')).toBe('ca-class-c');
  expect(findState('WA').code).toBe('CA');
});
