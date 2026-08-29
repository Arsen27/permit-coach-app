import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// The content schema is applied by the server from server/db/*.sql; the same
// files are copied into supabase/migrations for the record, the way every
// other migration of this project is kept. The copies must stay byte-identical
// — same idea as the wire.ts copies guarded by adminWireSync.test.ts.

const repoRoot = path.join(__dirname, '..');
const serverDir = path.join(repoRoot, 'server', 'db');

const serverFiles = readdirSync(serverDir)
  .filter(name => /^\d{4}_.*\.sql$/.test(name))
  .sort();

describe('content schema copies', () => {
  it('has at least the first content migration', () => {
    expect(serverFiles).toContain('0007_content_pipeline.sql');
  });

  it.each(serverFiles)('%s is byte-identical in supabase/migrations', name => {
    const server = readFileSync(path.join(serverDir, name), 'utf8');
    const supabase = readFileSync(
      path.join(repoRoot, 'supabase', 'migrations', name),
      'utf8',
    );

    expect(supabase).toBe(server);
  });
});
