-- DMV Prep: progress reset ops for server-driven course updates.
--
-- Course-content updates can invalidate progress (a corrected lesson must be
-- retaken). The monotonic merge in sync_push could never lower or delete a
-- row, so this migration teaches it `reset_ops`: explicit row deletions,
-- applied BEFORE the lesson/topic upserts so "reset + fresh attempt" in one
-- push ends with exactly the fresh attempt. Deletions then propagate to other
-- devices through sync_pull (the client treats the pulled snapshot as the
-- source of truth and replays only its own unpushed operations on top).
--
-- Apply via the Supabase SQL editor, after 0001/0002. `create or replace`
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
