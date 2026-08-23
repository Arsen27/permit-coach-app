// Minimal semver ("1.2.3") parsing/comparison. Deliberately duplicated on the
// server (server/src/semver.ts) — two tiny files beat a shared package.

export type Semver = {
  major: number;
  minor: number;
  patch: number;
};

export const parseSemver = (value: string): Semver | null => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (match == null) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

export const compareSemver = (a: Semver, b: Semver): -1 | 0 | 1 => {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (a[key] !== b[key]) {
      return a[key] < b[key] ? -1 : 1;
    }
  }
  return 0;
};

// Convenience over raw strings; unparseable input sorts as older-than-everything.
export const isVersionBelow = (value: string, other: string): boolean => {
  const a = parseSemver(value);
  const b = parseSemver(other);
  if (a == null || b == null) {
    return a == null && b != null;
  }
  return compareSemver(a, b) < 0;
};
