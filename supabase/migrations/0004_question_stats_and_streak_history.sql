-- DMV Prep: move the last device-local progress into the cloud.
--
-- Two things never reached the server and were lost when a learner switched
-- device or reinstalled:
--   * the lifetime streak stats (longest streak, days studied) — the profile
--     only carried the *current* run;
--   * per-question answer history, which the Practice question-bank map is
--     drawn from.
--
-- Both follow the existing monotonic posture: a push can raise a value or
-- extend a history, never lower or shorten one, so replaying an old device's
-- queue can't destroy newer progress.
--
-- Apply via the Supabase SQL editor, after 0001/0002/0003. `create or replace`
-- on the RPCs keeps their existing grants and security settings.

-- ---------------------------------------------------------------------------
-- Profile: lifetime streak stats
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists longest_streak int not null default 0
    check (longest_streak between 0 and 10000),
  add column if not exists days_studied int not null default 0
    check (days_studied between 0 and 100000);

-- Existing rows: the current run is the floor for both, mirroring
-- normalizeStreak() on the client.
update public.profiles
set longest_streak = greatest(longest_streak, current_streak),
    days_studied = greatest(days_studied, current_streak)
where longest_streak < current_streak or days_studied < current_streak;

-- profiles stays column-granted (plan is server-owned); add the two new ones.
grant update (longest_streak, days_studied) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Per-question answer history
-- ---------------------------------------------------------------------------

create table if not exists public.question_stats (
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text not null check (char_length(question_id) <= 64),
  -- Times answered, and how many of those were right. `last_correct` is what
  -- separates "missed" from "shaky" on the client, so it travels too.
  seen int not null default 0 check (seen between 0 and 10000),
  correct int not null default 0 check (correct between 0 and 10000),
  last_correct boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id),
  constraint question_stats_correct_within_seen check (correct <= seen)
);

alter table public.question_stats enable row level security;

create policy "own question stats" on public.question_stats
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.question_stats from anon;

create trigger set_updated_at before update on public.question_stats
  for each row execute function moddatetime (updated_at);

-- ---------------------------------------------------------------------------
-- sync_push: + question_stats, + lifetime streak stats
-- ---------------------------------------------------------------------------

create or replace function public.sync_push(payload jsonb)
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

  -- Reset ops first: 'lesson' → lesson_progress, 'topic' → topic_scores.
  delete from public.lesson_progress lp
  using jsonb_to_recordset(coalesce(payload -> 'reset_ops', '[]'::jsonb))
    as x (type text, id text)
  where x.type = 'lesson' and lp.user_id = uid and lp.lesson_id = x.id;

  delete from public.topic_scores ts
  using jsonb_to_recordset(coalesce(payload -> 'reset_ops', '[]'::jsonb))
    as x (type text, id text)
  where x.type = 'topic' and ts.user_id = uid and ts.topic_id = x.id;

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

  -- Question history: the longer history wins as a unit. Taking column-wise
  -- maxima instead would invent a row neither device ever had (and could
  -- report `correct` from one device against `seen` from another).
  insert into public.question_stats as qs
    (user_id, question_id, seen, correct, last_correct)
  select uid, x.id, x.seen, x.correct, x.last_correct
  from jsonb_to_recordset(coalesce(payload -> 'question_stats', '[]'::jsonb))
    as x (id text, seen int, correct int, last_correct boolean)
  where x.correct <= x.seen
  on conflict (user_id, question_id) do update set
    seen = excluded.seen,
    correct = excluded.correct,
    last_correct = excluded.last_correct
  where excluded.seen >= qs.seen;

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

  -- Streak: the later active date wins the run outright; same date keeps the
  -- larger. The lifetime stats are monotonic maxima regardless of date — they
  -- describe history, not the current run, so an older device still knows
  -- about days the newer one never saw.
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
      last_active_date = greatest(coalesce(p.last_active_date, incoming.d), incoming.d),
      longest_streak = greatest(p.longest_streak, coalesce(incoming.longest, 0)),
      days_studied = greatest(p.days_studied, coalesce(incoming.days, 0))
    from (
      select
        (payload #>> '{streak,last_active_date}')::date as d,
        (payload #>> '{streak,current_streak}')::int as s,
        (payload #>> '{streak,longest_streak}')::int as longest,
        (payload #>> '{streak,days_studied}')::int as days
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
-- sync_pull: + question_stats. The profile object is returned wholesale, so
-- longest_streak / days_studied ride along with the new columns.
-- ---------------------------------------------------------------------------

create or replace function public.sync_pull()
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
    'question_stats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', question_id,
        'seen', seen,
        'correct', correct,
        'last_correct', last_correct
      ))
      from public.question_stats
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
