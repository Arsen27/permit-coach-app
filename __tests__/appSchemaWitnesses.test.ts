import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Two halves of one database. The content half (server/db/) is applied and
// ledgered by the server itself; the app half here is pasted into the Supabase
// SQL editor by hand, and nothing recorded what ran — 0006 was absent from
// production long after it was written.
//
// The server now checks the app half at boot against a witness per migration
// (server/src/appSchema.ts). This test is what keeps that list honest: add a
// migration here and the check must learn to look for it, or a future skipped
// migration goes unnoticed exactly the way 0006 did.

const repoRoot = path.join(__dirname, '..');
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
const serverDbDir = path.join(repoRoot, 'server', 'db');
const witnessFile = path.join(repoRoot, 'server', 'src', 'appSchema.ts');

describe('app schema witnesses', () => {
  const appMigrations = readdirSync(migrationsDir)
    .filter(name => name.endsWith('.sql'))
    // Anything the server also carries under db/ is applied and ledgered by
    // the server; only the hand-applied ones need a witness.
    .filter(name => !existsSync(path.join(serverDbDir, name)))
    .sort();

  it('covers every hand-applied migration, in order', () => {
    const source = readFileSync(witnessFile, 'utf8');
    const declared = [...source.matchAll(/migration: '([^']+)'/g)].map(
      m => m[1],
    );

    expect(appMigrations.length).toBeGreaterThan(0);
    expect(declared).toEqual(appMigrations);
  });

  it('gives each witness something to look for and words to say it in', () => {
    const source = readFileSync(witnessFile, 'utf8');
    const entries = [
      ...source.matchAll(
        /migration: '([^']+)',\s*\n\s*witness: '([^']+)',\s*\n\s*probe: `([\s\S]*?)`,/g,
      ),
    ];

    expect(entries.map(e => e[1])).toEqual(appMigrations);
    for (const [, migration, witness, probe] of entries) {
      expect(witness.length).toBeGreaterThan(0);
      // Every probe must answer the one question the boot check asks.
      expect(probe).toMatch(/as ok/);
      expect(probe.toLowerCase().startsWith('select')).toBe(true);
      expect(migration).toMatch(/^\d{4}_[a-z_]+\.sql$/);
    }
  });
});
