-- Which states the app offers, and which course each one studies.
--
-- The list used to be three constants compiled into the binary, so a new
-- state meant an App Store release before anyone could pick it — however
-- ready its course was on the server. This is the same list, server-side:
-- the app asks for it, caches the answer, and a state added here is
-- selectable on every phone at its next launch.
--
-- One row per state, not per course: two states could share a course one day,
-- and the app asks "what can I pick", not "what exists". `available` is what
-- the app is told about; a row is added while its course is still being
-- written and flipped on when it is published.

create table public.course_catalogue (
  state_code text primary key check (state_code ~ '^[A-Z]{2}$'),
  name text not null check (length(name) between 1 and 64),
  course_id text not null check (course_id ~ '^[a-z0-9][a-z0-9.-]*$'),
  -- The official DMV/DOT domain: the app opens the handbook there and shows
  -- it under the state's name.
  domain text not null check (domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  -- Where the state sits in the picker; ties break by name.
  sort_order int not null default 100,
  available boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

create index course_catalogue_order
  on public.course_catalogue (available, sort_order, name);

-- The three states the binary used to carry. Ordered as the pickers showed
-- them, and available because their courses are published.
insert into public.course_catalogue
  (state_code, name, course_id, domain, sort_order, available, updated_by)
values
  ('CA', 'California', 'ca-class-c', 'dmv.ca.gov', 10, true, 'migration'),
  ('FL', 'Florida', 'fl-class-e', 'flhsmv.gov', 20, true, 'migration'),
  ('TX', 'Texas', 'tx-class-c', 'dps.texas.gov', 30, true, 'migration')
on conflict (state_code) do nothing;

do $$
declare
  r text;
begin
  execute 'alter table public.course_catalogue enable row level security';
  execute 'revoke all on public.course_catalogue from public';
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on public.course_catalogue from %I', r);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.course_catalogue to service_role';
  end if;
end $$;
