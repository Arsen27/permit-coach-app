-- Course content pipeline: releases, content-addressed documents, channels,
-- drafts, admin settings, image metadata and the signs catalogue. Replaces the
-- git-tracked server/content/ tree; publishing becomes a pointer move here
-- instead of a git push. Image bytes live in Supabase Storage (bucket
-- content-assets) — Postgres holds only their metadata.
--
-- Canonical copy: server/db/0007_content_pipeline.sql — the server's tests run
-- this exact file under PGlite. supabase/migrations/0007_content_pipeline.sql
-- is the byte-identical copy pasted into the SQL editor; the app repo's
-- __tests__/migrationSync.test.ts keeps the two in step.

-- Document bodies are the exact bytes the app hash-verifies
-- (src/data/course/v2/verify.ts); the preimage is serializeJson(doc) =
-- JSON.stringify(v, null, 2) + '\n' (server/src/admin/canonical.ts). The two
-- checks make it impossible to store a body under the wrong hash or size.
create table public.content_documents (
  sha256 text primary key check (sha256 ~ '^[0-9a-f]{64}$'),
  body text not null,
  size_bytes int not null,
  created_at timestamptz not null default now(),
  constraint content_documents_size check (size_bytes = octet_length(body)),
  constraint content_documents_hash
    check (sha256 = encode(pg_catalog.sha256(convert_to(body, 'UTF8')), 'hex'))
);

-- One row per released course version. The generated major/minor/patch make
-- ORDER BY real semver rather than text order (3.2.10 after 3.2.9).
create table public.course_releases (
  course_id text not null check (course_id ~ '^[a-z0-9][a-z0-9.-]*$'),
  version text not null check (version ~ '^\d+\.\d+\.\d+$'),
  major int generated always as (split_part(version, '.', 1)::int) stored,
  minor int generated always as (split_part(version, '.', 2)::int) stored,
  patch int generated always as (split_part(version, '.', 3)::int) stored,
  released_at date not null,
  status text not null default 'release_candidate',
  min_app_version text not null check (min_app_version ~ '^\d+\.\d+\.\d+$'),
  notes text not null default '',
  -- null = auto adoption; 'opt_in' = offered, never imposed.
  adoption text check (adoption in ('opt_in')),
  source_version_label text not null default '',
  source_review_status text not null default '',
  publication_authorized boolean not null default false,
  instructions jsonb not null default '[]'::jsonb,
  -- The draft's fork point; audit only.
  base_version text,
  created_at timestamptz not null default now(),
  created_by text not null default '',
  primary key (course_id, version)
);
create index course_releases_order
  on public.course_releases (course_id, major, minor, patch);

-- One row per served path of a release: 'course', 'modules/<id>', 'lessons/<id>'.
-- The manifest `documents` block the app receives is derived from these rows.
create table public.course_release_documents (
  course_id text not null,
  version text not null,
  rel_path text not null
    check (rel_path = 'course' or rel_path ~ '^(modules|lessons)/[a-z0-9][a-z0-9-]*$'),
  -- Set for lessons/*: the manifest's lessons[id].moduleId.
  module_id text,
  sha256 text not null references public.content_documents (sha256),
  primary key (course_id, version, rel_path),
  foreign key (course_id, version)
    references public.course_releases (course_id, version) on delete cascade
);
create index course_release_documents_sha
  on public.course_release_documents (sha256);

-- What each channel serves. Publishing, promoting and rolling back are all
-- "point the channel at a version"; every move is recorded below.
create table public.content_channels (
  course_id text not null,
  channel text not null check (channel in ('staging', 'production')),
  version text not null,
  updated_at timestamptz not null default now(),
  updated_by text not null default '',
  primary key (course_id, channel),
  foreign key (course_id, version)
    references public.course_releases (course_id, version)
);
create table public.content_channel_history (
  id bigserial primary key,
  course_id text not null,
  channel text not null check (channel in ('staging', 'production')),
  from_version text,
  to_version text not null,
  actor text not null,
  reason text not null default '',
  at timestamptz not null default now()
);
create index content_channel_history_course
  on public.content_channel_history (course_id, at desc);

-- Drafts: one header row plus one row per entity, mirroring the on-disk
-- layout the admin used before (course.json, modules/*, lessons/*,
-- questions/questions.json, assets/assets.json).
create table public.course_drafts (
  course_id text not null,
  draft_id text not null check (draft_id ~ '^[a-z0-9][a-z0-9.-]*$'),
  version_label text not null,
  base_version text not null,
  notes text not null default '',
  -- CourseInfoV2; moduleIds are rewritten on every write.
  course jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text not null default '',
  primary key (course_id, draft_id)
);
create table public.course_draft_entities (
  course_id text not null,
  draft_id text not null,
  kind text not null check (kind in ('module', 'lesson', 'question', 'asset')),
  entity_id text not null,
  -- Module order; lessons are ordered by their module's lessonIds.
  position int not null default 0,
  body jsonb not null,
  primary key (course_id, draft_id, kind, entity_id),
  foreign key (course_id, draft_id)
    references public.course_drafts (course_id, draft_id) on delete cascade
);
-- A released draft is kept whole for the audit trail.
create table public.course_draft_archive (
  course_id text not null,
  draft_id text not null,
  released_version text not null,
  contents jsonb not null,
  archived_at timestamptz not null default now(),
  primary key (course_id, draft_id, released_version)
);

-- Panel preferences (formerly content-admin/settings.json) and the app-release
-- gate served by /v1/bootstrap and /v1/app-release (formerly constants in
-- server/src/config.ts).
create table public.admin_settings (
  id smallint primary key default 1 check (id = 1),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.app_release_settings (
  id smallint primary key default 1 check (id = 1),
  min_supported_app_version text not null default '1.0.0'
    check (min_supported_app_version ~ '^\d+\.\d+\.\d+$'),
  ios_latest_version text not null default '1.0.0',
  ios_store_url text not null default '',
  android_latest_version text not null default '1.0.0',
  android_store_url text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);
insert into public.admin_settings (id) values (1);
insert into public.app_release_settings (id) values (1);

-- Images, shared by courses and signs: bytes live in the Storage bucket under
-- <sha256>.<ext>; a row appears only after the upload succeeded, so a release
-- can never reference a file that is not there.
create table public.content_assets (
  sha256 text primary key check (sha256 ~ '^[0-9a-f]{64}$'),
  mime text not null check (mime in ('image/svg+xml', 'image/png', 'image/jpeg')),
  size_bytes int not null check (size_bytes > 0),
  width int not null,
  height int not null,
  created_at timestamptz not null default now(),
  created_by text not null default ''
);
create table public.course_release_assets (
  course_id text not null,
  version text not null,
  sha256 text not null references public.content_assets (sha256),
  primary key (course_id, version, sha256),
  foreign key (course_id, version)
    references public.course_releases (course_id, version) on delete cascade
);

-- Signs catalogue: no version numbers — the catalogue's identity is the sha256
-- of its document. One editable working copy; each channel points at a
-- snapshot stored in content_documents.
create table public.signs_working (
  id smallint primary key default 1 check (id = 1),
  body text not null,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);
create table public.signs_channels (
  channel text primary key check (channel in ('staging', 'production')),
  sha256 text not null references public.content_documents (sha256),
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);
create table public.signs_channel_history (
  id bigserial primary key,
  channel text not null check (channel in ('staging', 'production')),
  from_sha256 text,
  to_sha256 text not null,
  actor text not null,
  at timestamptz not null default now()
);

-- Server-only tables: no mobile client may read or mutate content state. RLS
-- is enabled so PostgREST can never expose them; the server connects with the
-- database role, which bypasses RLS. The Supabase roles do not exist under
-- PGlite, hence the guards — the same file must run in both.
do $$
declare
  t text;
  r text;
begin
  foreach t in array array[
    'content_documents', 'course_releases', 'course_release_documents',
    'content_channels', 'content_channel_history',
    'course_drafts', 'course_draft_entities', 'course_draft_archive',
    'admin_settings', 'app_release_settings',
    'content_assets', 'course_release_assets',
    'signs_working', 'signs_channels', 'signs_channel_history'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public', t);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on public.%I from %I', t, r);
      end if;
    end loop;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format(
        'grant select, insert, update, delete on public.%I to service_role', t
      );
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage, select on all sequences in schema public to service_role;
  end if;
end $$;
