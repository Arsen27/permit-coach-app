// Namespaced console logging for the content-update and sync flows, so the
// whole pipeline can be watched in the Metro console while testing.
//
// Silent in release builds and under jest. Set DEBUG_LOGS to false to mute it
// during development without touching call sites.
//
// Namespaces in use: [net] [course] [store] [sync] [paywall].

const DEBUG_LOGS = true;

const isDevBuild = (): boolean => typeof __DEV__ !== 'undefined' && __DEV__;

const isEnabled = (alsoInRelease: boolean): boolean =>
  DEBUG_LOGS &&
  process.env.NODE_ENV !== 'test' &&
  (alsoInRelease || isDevBuild());

export type Logger = {
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
  // Starts a stopwatch; the returned function reports elapsed milliseconds.
  time: () => () => number;
};

// Release builds are silent by default. Diagnostics that have to survive into
// a TestFlight build — where there is no Metro console and the only readout is
// the device log — opt in with alsoInRelease.
export const createLogger = (
  namespace: string,
  alsoInRelease = false,
): Logger => {
  const emit = (
    level: 'log' | 'warn' | 'error',
    message: string,
    data?: unknown,
  ): void => {
    if (!isEnabled(alsoInRelease)) {
      return;
    }
    const line = `[${namespace}] ${message}`;
    if (data === undefined) {
      console[level](line);
    } else {
      console[level](line, data);
    }
  };

  return {
    info: (message, data) => emit('log', message, data),
    warn: (message, data) => emit('warn', message, data),
    error: (message, data) => emit('error', message, data),
    time: () => {
      const started = Date.now();
      return () => Date.now() - started;
    },
  };
};

export const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : bytes >= 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${bytes} B`;
