-- The question bank: its own entity, referenced by courses by question id.
--
-- Questions update the way the signs catalogue does — wholesale, immediately,
-- for everyone — so they live outside the versioned releases: one working
-- document per course, edited in place, and two channel pointers at snapshots
-- of it. The snapshots go into content_documents by their own sha256, so a
-- rollback is just another publish and nothing is ever overwritten.

create table public.question_banks (
  course_id text primary key check (course_id ~ '^[a-z0-9][a-z0-9.-]*$'),
  body text not null,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

create table public.bank_channels (
  course_id text not null,
  channel text not null check (channel in ('staging', 'production')),
  sha256 text not null references public.content_documents (sha256),
  updated_at timestamptz not null default now(),
  updated_by text not null default '',
  primary key (course_id, channel)
);

create table public.bank_channel_history (
  id bigserial primary key,
  course_id text not null,
  channel text not null,
  from_sha256 text,
  to_sha256 text not null,
  actor text not null,
  at timestamptz not null default now()
);

do $$
declare
  t text;
  r text;
begin
  foreach t in array array[
    'question_banks', 'bank_channels', 'bank_channel_history'
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
