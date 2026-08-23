import {
  compareSemver,
  isVersionBelow,
  parseSemver,
} from '@/data/course/semver';

describe('semver', () => {
  it('parses well-formed versions and rejects everything else', () => {
    expect(parseSemver('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseSemver('10.0.0')).toEqual({ major: 10, minor: 0, patch: 0 });
    for (const bad of ['', '1.2', '1.2.3.4', 'v1.2.3', '1.2.x', 'garbage']) {
      expect(parseSemver(bad)).toBeNull();
    }
  });

  it('compares by major, then minor, then patch', () => {
    const compare = (a: string, b: string) =>
      compareSemver(parseSemver(a)!, parseSemver(b)!);
    expect(compare('1.0.0', '1.0.0')).toBe(0);
    expect(compare('1.0.1', '1.0.0')).toBe(1);
    expect(compare('1.1.0', '1.0.9')).toBe(1);
    expect(compare('2.0.0', '1.9.9')).toBe(1);
    expect(compare('1.0.0', '1.0.1')).toBe(-1);
  });

  it('isVersionBelow treats unparseable input as older than everything', () => {
    expect(isVersionBelow('1.0.0', '1.0.1')).toBe(true);
    expect(isVersionBelow('1.0.1', '1.0.0')).toBe(false);
    expect(isVersionBelow('1.0.0', '1.0.0')).toBe(false);
    expect(isVersionBelow('garbage', '1.0.0')).toBe(true);
    expect(isVersionBelow('1.0.0', 'garbage')).toBe(false);
  });
});
