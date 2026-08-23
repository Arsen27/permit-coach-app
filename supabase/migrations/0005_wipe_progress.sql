-- DMV Prep: full progress wipe for state switches.
--
-- Moving to another state's course makes every progress row meaningless: the
-- lesson/topic/question ids belong to the old course, and best_exam measured
-- the old exam. The client sends `wipe_progress: true` in the same sync_push
-- as its profile update (new state_code) and any first answers in the new
-- course; the wipe runs FIRST, so rows pushed alongside it survive as the new
-- truth. Streak and saved signs (road signs are federal) are untouched.
--
-- Apply via the Supabase SQL editor, after 0001–0004. `create or replace`
-- keeps the existing grants and security settings.

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

  -- Wipe first: the rest of this payload describes the post-wipe world.
  if coalesce((payload ->> 'wipe_progress')::boolean, false) then
    delete from public.lesson_progress where user_id = uid;
    delete from public.topic_scores where user_id = uid;
    delete from public.question_stats where user_id = uid;
    delete from public.mistakes where user_id = uid;
    delete from public.saved_items
      where user_id = uid and item_type = 'question';
    update public.profiles set best_exam = null where id = uid;
  end if;

  -- Reset ops next: 'lesson' → lesson_progress, 'topic' → topic_scores.
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

  -- Question history: the longer history wins as a unit (see 0004).
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
  -- larger. Lifetime stats are monotonic maxima regardless of date.
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
