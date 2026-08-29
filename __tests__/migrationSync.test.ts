import { readFileSync } from 'node:fs';
import path from 'node:path';

// The content-pipeline migration is pasted into the Supabase SQL editor from
// supabase/migrations, while the server runs its own canonical copy under
// PGlite in its tests. The two must stay byte-identical — same idea as the
// wire.ts copies guarded by adminWireSync.test.ts.

const repoRoot = path.join(__dirname, '..');

// Each entry: [server-side canonical file, the copy pasted into Supabase].
const COPIES: [string, string][] = [
  [
    'server/db/0007_content_pipeline.sql',
    'supabase/migrations/0007_content_pipeline.sql',
  ],
];

describe.each(COPIES)(
  'content migration copy: %s',
  (serverPath, supabasePath) => {
    it('is byte-identical in the server repo and in supabase/migrations', () => {
      const server = readFileSync(path.join(repoRoot, serverPath), 'utf8');
      const supabase = readFileSync(path.join(repoRoot, supabasePath), 'utf8');

      expect(supabase).toBe(server);
    });

    it('names its canonical copy so nobody edits the pasted one by hand', () => {
      const supabase = readFileSync(path.join(repoRoot, supabasePath), 'utf8');

      expect(supabase).toContain(serverPath);
    });
  },
);
