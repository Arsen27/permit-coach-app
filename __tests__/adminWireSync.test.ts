import { readFileSync } from 'node:fs';
import path from 'node:path';

// The admin server keeps its own copy of the wire format because it lives in a
// separate repository and cannot import from src/. Both sides must stay
// identical: a drift here means the admin could write documents the app
// refuses to parse.

const HEADER_LINES = 7;

const repoRoot = path.join(__dirname, '..');

// Each entry: [app-side source of truth, the server's copy].
const COPIES: [string, string][] = [
  ['src/data/course/v2/wire.ts', 'server/src/admin/wire.ts'],
  ['src/data/signs/wire.ts', 'server/src/admin/signsWire.ts'],
];

describe.each(COPIES)('admin wire format copy: %s', (appPath, serverPath) => {
  const appWire = path.join(repoRoot, appPath);
  const serverWire = path.join(repoRoot, serverPath);

  it('matches the app wire format byte for byte below its provenance header', () => {
    const app = readFileSync(appWire, 'utf8');
    const server = readFileSync(serverWire, 'utf8');
    const copied = server.split('\n').slice(HEADER_LINES).join('\n');

    expect(copied).toBe(app);
  });

  it('keeps the provenance header that names the source of truth', () => {
    const header = readFileSync(serverWire, 'utf8')
      .split('\n')
      .slice(0, HEADER_LINES)
      .join('\n');

    expect(header).toContain(appPath);
    expect(header).toContain('never patch this file by hand');
  });
});
