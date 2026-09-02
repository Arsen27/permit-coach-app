-- Uploading a whole course version through the MCP door.
--
-- A complete package is far more than one chat message: the door takes it a
-- document at a time and assembles it here, so the parts survive a restart
-- and can be inspected, replaced or thrown away before anything is created.
-- Committing turns the assembled set into an ordinary draft — from there the
-- normal diff → release → staging path applies, unchanged.
--
-- Bodies are text, not json: they are canonical documents whose bytes are the
-- thing being staged, and a driver that reshapes them on the way in or out
-- would defeat the point.

create table public.content_imports (
  course_id text not null check (course_id ~ '^[a-z0-9][a-z0-9.-]*$'),
  import_id text not null check (import_id ~ '^[a-z0-9][a-z0-9.-]*$'),
  version_label text not null,
  -- The release this package is built on. '0.0.0' for a course that has no
  -- releases at all, which is how a brand-new course arrives.
  base_version text not null,
  notes text not null default '',
  -- Set once the import has become a draft; a committed import is kept as a
  -- record and refuses to commit twice.
  draft_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text not null default '',
  primary key (course_id, import_id)
);

create table public.content_import_documents (
  course_id text not null,
  import_id text not null,
  rel_path text not null check (
    rel_path = 'course'
    or rel_path ~ '^(modules|lessons)/[a-z0-9][a-z0-9-]*$'
  ),
  -- Which module a lesson belongs to, and where in it; null for the course
  -- document and for the module shells themselves.
  module_id text,
  position int not null default 0,
  body text not null,
  size_bytes int not null check (size_bytes > 0),
  updated_at timestamptz not null default now(),
  primary key (course_id, import_id, rel_path),
  foreign key (course_id, import_id)
    references public.content_imports (course_id, import_id) on delete cascade
);

create index content_import_documents_module
  on public.content_import_documents (course_id, import_id, module_id, position);

do $$
declare
  t text;
  r text;
begin
  foreach t in array array['content_imports', 'content_import_documents'] loop
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
end $$;
