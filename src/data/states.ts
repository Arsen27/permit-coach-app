import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { createLogger } from '@/lib/log';
import { SERVER_URL, isServerConfigured } from '@/lib/serverConfig';

// Which states the app offers. The server owns the list — adding a state is
// a row in its catalogue, not a release in the App Store — and the phone
// keeps the last answer so a picker opened offline still shows what it knew.
//
// The three states below are what the binary shipped with. They are the
// floor, not the truth: a first launch with no network gets them rather than
// an empty screen, and every answer from the server replaces them.

export type UsState = {
  code: string;
  name: string;
  courseId: string;
  // Official DMV/DOT domain — the state handbook opens here in the system
  // browser and drives the You-screen subtitle.
  domain: string;
};

const FALLBACK_STATES: UsState[] = [
  {
    code: 'CA',
    name: 'California',
    courseId: 'ca-class-c',
    domain: 'dmv.ca.gov',
  },
  { code: 'FL', name: 'Florida', courseId: 'fl-class-e', domain: 'flhsmv.gov' },
  {
    code: 'TX',
    name: 'Texas',
    courseId: 'tx-class-c',
    domain: 'dps.texas.gov',
  },
];

const CACHE_KEY = 'dmv-prep/states/v1';
const TIMEOUT_MS = 10000;

const log = createLogger('net');

// Whether the list on screen is the server's, the phone's memory of it, or
// the floor the binary carries — and, when nothing could be fetched, why.
export type StatesSource = 'server' | 'cache' | 'fallback';

export type StatesState = {
  states: UsState[];
  source: StatesSource;
  // Set when the last attempt to reach the server failed. The list is still
  // usable; a picker says so rather than pretending it is complete.
  offline: boolean;
  loading: boolean;
};

let current: StatesState = {
  states: FALLBACK_STATES,
  source: 'fallback',
  offline: false,
  loading: false,
};
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;
let loadedOnce = false;

const notify = () => {
  listeners.forEach(listener => listener());
};

const set = (next: Partial<StatesState>) => {
  current = { ...current, ...next };
  notify();
};

// One row is only as good as the app's ability to render it: a state missing
// a field, or carrying one of the wrong shape, is dropped rather than shown.
const parseStates = (payload: unknown): UsState[] => {
  const rows = (payload as { states?: unknown })?.states;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.flatMap(row => {
    const value = row as Record<string, unknown>;
    const state = {
      code: value.stateCode ?? value.code,
      name: value.name,
      courseId: value.courseId,
      domain: value.domain,
    };
    return typeof state.code === 'string' &&
      /^[A-Z]{2}$/.test(state.code) &&
      typeof state.name === 'string' &&
      state.name.length > 0 &&
      typeof state.courseId === 'string' &&
      state.courseId.length > 0 &&
      typeof state.domain === 'string' &&
      state.domain.length > 0
      ? [state as UsState]
      : [];
  });
};

// The list the phone remembers, read once per launch before any request goes
// out: a picker opened offline shows what the learner saw last time.
const readCache = async (): Promise<UsState[] | null> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw == null) {
      return null;
    }
    const states = parseStates(JSON.parse(raw));
    return states.length > 0 ? states : null;
  } catch {
    return null;
  }
};

const refresh = async (): Promise<void> => {
  if (!isServerConfigured) {
    return;
  }
  set({ loading: true });
  try {
    const response = await fetchWithRetry(`${SERVER_URL}/v1/courses`, {
      timeoutMs: TIMEOUT_MS,
    });
    if (!response.ok) {
      throw new Error(`courses responded ${response.status}`);
    }
    const body = await response.text();
    const states = parseStates(JSON.parse(body));
    if (states.length === 0) {
      throw new Error('courses answered with no usable state');
    }
    await AsyncStorage.setItem(CACHE_KEY, body).catch(() => undefined);
    log.info(`states: ${states.length} from the server`);
    set({ states, source: 'server', offline: false, loading: false });
  } catch (error) {
    log.warn(
      'states: could not reach the server',
      error instanceof Error ? error.message : error,
    );
    set({ offline: true, loading: false });
  }
};

// Restores the cached list, then asks the server. Safe to call from several
// screens: the work happens once per launch, and every caller awaits it.
export const loadStates = (): Promise<void> => {
  if (inFlight != null) {
    return inFlight;
  }
  if (loadedOnce) {
    return Promise.resolve();
  }
  inFlight = (async () => {
    const cached = await readCache();
    if (cached != null) {
      set({ states: cached, source: 'cache' });
    }
    await refresh();
    loadedOnce = true;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
};

// Asks again after a failure — what a "Try again" button does.
export const retryStates = (): Promise<void> => {
  loadedOnce = false;
  return loadStates();
};

export const statesSnapshot = (): StatesState => current;

export const SUPPORTED_STATES_FALLBACK = FALLBACK_STATES;

export const findState = (code: string): UsState =>
  current.states.find(state => state.code === code) ??
  FALLBACK_STATES.find(state => state.code === code) ??
  current.states[0] ??
  FALLBACK_STATES[0];

// The course a state studies. Unknown states fall back to the default course
// so a stale stored state code can never leave the app without one.
export const courseIdForStateCode = (code: string): string =>
  current.states.find(state => state.code === code)?.courseId ??
  FALLBACK_STATES.find(state => state.code === code)?.courseId ??
  FALLBACK_STATES[0].courseId;

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// The list plus how it was come by, kicking off the load on first mount.
export const useStates = (): StatesState => {
  useEffect(() => {
    void loadStates();
  }, []);
  return useSyncExternalStore(subscribe, statesSnapshot);
};

// Whether the picker is still waiting on its first answer — a spinner rather
// than a list that is about to change under the learner's finger.
export const useStatesReady = (): boolean => {
  const { source, loading } = useStates();
  const [settled, setSettled] = useState(source !== 'fallback');
  useEffect(() => {
    if (source !== 'fallback' || !loading) {
      setSettled(true);
    }
  }, [source, loading]);
  return settled;
};

// Test seam.
export const resetStatesForTests = (): void => {
  current = {
    states: FALLBACK_STATES,
    source: 'fallback',
    offline: false,
    loading: false,
  };
  listeners.clear();
  inFlight = null;
  loadedOnce = false;
};
