-- Where the course sources are authored.
--
-- Step 1 gave the server the skeleton as a data document, read from
-- server/skeleton/*.json on disk. Reading from disk is fine; writing to it is
-- not — Railway's filesystem is ephemeral, so an edit saved there is discarded
-- by the next deploy. Everything else mutable in this server already lives in
-- Postgres, and now so does authoring.
--
-- Two subjects: 'skeleton' — the universal skeleton every state's course is
-- generated from — and 'state:XX' — one state package: its parameters, the
-- notes it anchors onto shared cards, its card and question overrides, the
-- lessons of its own module, and its picture overrides. One working row each,
-- plus an immutable revision every time somebody decides a set of edits is
-- worth naming.
--
-- json, not jsonb, for the same reason course_drafts uses it (0008): jsonb
-- sorts keys, and these documents are exported back to the files they were
-- seeded from, byte for byte. The repository stays the durable mirror — the
-- toolchain was recently found to exist in a single copy on one disk, and the
-- export is what keeps that from happening again.

-- The working copy: what the panel edits and what an export writes out.
create table public.authoring_documents (
  subject text primary key
    check (subject = 'skeleton' or subject ~ '^state:[A-Z]{2}$'),
  document json not null,
  -- The newest revision cut from this subject; 0 until the first one.
  revision int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

-- Immutable snapshots. The number is monotonic per subject, so "revision 4"
-- names one document for good and any two can be diffed or one restored.
create table public.authoring_revisions (
  subject text not null,
  revision int not null check (revision > 0),
  document json not null,
  -- sha256 of the exported bytes, which is what a release records as its
  -- provenance: the same number from either side of the export.
  content_sha text not null check (content_sha ~ '^[0-9a-f]{64}$'),
  message text not null default '',
  author text not null default '',
  created_at timestamptz not null default now(),
  primary key (subject, revision),
  foreign key (subject) references public.authoring_documents (subject)
    on delete cascade
);

-- Every edit, in order. Generation is step 3 and lockstep with this table:
-- a release stamps the revisions it was built from, and until then the panel
-- can say how much has accumulated since the last one.
create table public.authoring_edits (
  id bigserial primary key,
  subject text not null,
  -- What was touched: a shared card, a question, a state note, a parameter,
  -- a picture, a state lesson — or the two moves between subjects.
  kind text not null check (kind in (
    'card', 'question', 'note', 'param', 'asset', 'lesson',
    'override', 'revert', 'promote', 'restore'
  )),
  -- The bare block id, question id, parameter key or note anchor.
  target text not null,
  summary text not null default '',
  actor text not null default '',
  at timestamptz not null default now()
);
create index authoring_edits_subject on public.authoring_edits (subject, at desc);
