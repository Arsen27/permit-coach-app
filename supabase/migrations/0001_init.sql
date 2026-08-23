-- DMV Prep: initial schema — user progress + monotonic sync RPCs.
-- Content (questions, lessons, signs) is bundled in the app and has no
-- tables here; item ids reference bundled content.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per auth user, anonymous users included (created by trigger below).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 100),
  state_code text not null default 'CA' check (char_length(state_code) = 2),
  -- Not client-writable (see grants below); a RevenueCat webhook will own it.
  plan text not null default 'free' check (plan in ('free', 'plus')),
  accent_id text not null default 'blue' check (char_length(accent_id) <= 32),
  font_id text not null default 'jakarta' check (char_length(font_id) <= 32),
  best_exam int check (best_exam between 0 and 100),
  current_streak int not null default 0 check (current_streak between 0 and 10000),
  -- Device-local calendar date of the last learning activity.
  last_active_date date,
  updated_at timestamptz not null default now()
);

create table public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) <= 64),
  answered int not null default 0 check (answered between 0 and 100),
  correct int not null default 0 check (correct between 0 and 100),
  points int not null default 0 check (points between 0 and 1000),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.topic_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id text not null check (char_length(topic_id) <= 64),
  best_percent int not null default 0 check (best_percent between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

-- Bookmarks on bundled content: saved questions and saved signs. Mistakes are
-- deliberately a separate table — not a bookmark, and the likely home of
-- spaced-repetition metadata later.
create table public.saved_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_type text not null check (item_type in ('question', 'sign')),
  item_id text not null check (char_length(item_id) <= 64),
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

create table public.mistakes (
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text not null check (char_length(question_id) <= 64),
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

-- ---------------------------------------------------------------------------
-- Row-level security: owner-only, keyed on auth.uid()
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.topic_scores enable row level security;
alter table public.saved_items enable row level security;
alter table public.mistakes enable row level security;

create policy "own profile" on public.profiles
  for all using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "own lesson progress" on public.lesson_progress
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own topic scores" on public.topic_scores
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own saved items" on public.saved_items
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own mistakes" on public.mistakes
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Unauthenticated requests have no business here at all.
revoke all on public.profiles,
  public.lesson_progress,
  public.topic_scores,
  public.saved_items,
  public.mistakes
from anon;

-- profiles.plan is server-owned: column-level grant (not RLS) keeps clients —
-- including security-invoker RPCs — from ever writing it. Inserts/deletes go
-- through the auth trigger and cascade only.
revoke insert, update, delete on public.profiles from authenticated;
grant update (
  name,
  state_code,
  accent_id,
  font_id,
  best_exam,
  current_streak,
  last_active_date
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- updated_at maintenance + profile auto-creation
-- ---------------------------------------------------------------------------

create extension if not exists moddatetime;

create trigger set_updated_at before update on public.profiles
  for each row execute function moddatetime (updated_at);
create trigger set_updated_at before update on public.lesson_progress
  for each row execute function moddatetime (updated_at);
create trigger set_updated_at before update on public.topic_scores
  for each row execute function moddatetime (updated_at);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- sync_push: one atomic round trip for the client's dirty entities.
-- security INVOKER — RLS and column grants still apply; every row is keyed on
-- auth.uid(), any user id inside the payload is ignored.
-- Merge rules are monotonic and mirror src/sync/merge.ts.
-- ---------------------------------------------------------------------------

create function public.sync_push(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.lesson_progress as lp
    (user_id, lesson_id, answered, correct, points, completed)
  select uid, x.id, x.answered, x.correct, x.points, x.completed
  from jsonb_to_recordset(coalesce(payload -> 'lessons', '[]'::jsonb))
    as x (id text, answered int, correct int, points int, completed boolean)
  on conflict (user_id, lesson_id) do update set
    answered = excluded.answered,
    correct = excluded.correct,
    points = greatest(lp.points, excluded.points),
    completed = lp.completed or excluded.completed;

  insert into public.topic_scores as ts (user_id, topic_id, best_percent)
  select uid, x.id, x.best_percent
  from jsonb_to_recordset(coalesce(payload -> 'topics', '[]'::jsonb))
    as x (id text, best_percent int)
  on conflict (user_id, topic_id) do update set
    best_percent = greatest(ts.best_percent, excluded.best_percent);

  if payload ? 'best_exam' then
    update public.profiles
    set best_exam = greatest(coalesce(best_exam, 0), (payload ->> 'best_exam')::int)
    where id = uid;
  end if;

  -- Profile preferences are last-write-wins.
  if payload ? 'profile' then
    update public.profiles
    set
      name = coalesce(payload #>> '{profile,name}', name),
      state_code = coalesce(payload #>> '{profile,state_code}', state_code),
      accent_id = coalesce(payload #>> '{profile,accent_id}', accent_id),
      font_id = coalesce(payload #>> '{profile,font_id}', font_id)
    where id = uid;
  end if;

  -- Streak: the later active date wins outright; same date keeps the larger.
  if payload ? 'streak' then
    update public.profiles p
    set
      current_streak = case
        when p.last_active_date is null or incoming.d > p.last_active_date
          then incoming.s
        when incoming.d = p.last_active_date
          then greatest(p.current_streak, incoming.s)
        else p.current_streak
      end,
      last_active_date = greatest(coalesce(p.last_active_date, incoming.d), incoming.d)
    from (
      select
        (payload #>> '{streak,last_active_date}')::date as d,
        (payload #>> '{streak,current_streak}')::int as s
    ) incoming
    where p.id = uid and incoming.d is not null;
  end if;

  -- Set deltas. 'question'/'sign' → saved_items, 'mistake' → mistakes.
  insert into public.saved_items (user_id, item_type, item_id)
  select uid, x.type, x.id
  from jsonb_to_recordset(coalesce(payload -> 'set_ops', '[]'::jsonb))
    as x (type text, id text, op text)
  where x.op = 'add' and x.type in ('question', 'sign')
  on conflict do nothing;

  delete from public.saved_items si
  using jsonb_to_recordset(coalesce(payload -> 'set_ops', '[]'::jsonb))
    as x (type text, id text, op text)
  where x.op = 'remove' and x.type in ('question', 'sign')
    and si.user_id = uid and si.item_type = x.type and si.item_id = x.id;

  insert into public.mistakes (user_id, question_id)
  select uid, x.id
  from jsonb_to_recordset(coalesce(payload -> 'set_ops', '[]'::jsonb))
    as x (type text, id text, op text)
  where x.op = 'add' and x.type = 'mistake'
  on conflict do nothing;

  delete from public.mistakes m
  using jsonb_to_recordset(coalesce(payload -> 'set_ops', '[]'::jsonb))
    as x (type text, id text, op text)
  where x.op = 'remove' and x.type = 'mistake'
    and m.user_id = uid and m.question_id = x.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- sync_pull: everything the current user has, in one round trip.
-- ---------------------------------------------------------------------------

create function public.sync_pull()
returns jsonb
language sql
security invoker
set search_path = public
stable
as $$
  select jsonb_build_object(
    'profile', (
      select to_jsonb(p) - 'id' - 'updated_at'
      from public.profiles p
      where p.id = auth.uid()
    ),
    'lessons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', lesson_id,
        'answered', answered,
        'correct', correct,
        'points', points,
        'completed', completed
      ))
      from public.lesson_progress
      where user_id = auth.uid()
    ), '[]'::jsonb),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object('id', topic_id, 'best_percent', best_percent))
      from public.topic_scores
      where user_id = auth.uid()
    ), '[]'::jsonb),
    'saved', coalesce((
      select jsonb_agg(jsonb_build_object('type', item_type, 'id', item_id))
      from public.saved_items
      where user_id = auth.uid()
    ), '[]'::jsonb),
    'mistakes', coalesce((
      select jsonb_agg(question_id)
      from public.mistakes
      where user_id = auth.uid()
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- delete_account: App Store guideline 5.1.1(v) requires in-app account
-- deletion. security DEFINER — deleting from auth.users needs elevated
-- rights; scoped strictly to the calling user. Cascades wipe all data.
-- ---------------------------------------------------------------------------

create function public.delete_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function public.sync_push (jsonb) from public, anon;
revoke execute on function public.sync_pull () from public, anon;
revoke execute on function public.delete_account () from public, anon;
grant execute on function public.sync_push (jsonb) to authenticated;
grant execute on function public.sync_pull () to authenticated;
grant execute on function public.delete_account () to authenticated;
