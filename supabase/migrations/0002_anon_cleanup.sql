-- Anonymous users accumulate in auth.users (every log-out mints one; some
-- installs never return). Nightly cleanup deletes anonymous users older than
-- 30 days with no progress at all — cascades remove their empty profiles.
--
-- pg_cron is available on Supabase; enable it under Database → Extensions if
-- this migration fails on `create extension`.

create extension if not exists pg_cron;

select cron.schedule(
  'cleanup-stale-anon-users',
  '0 3 * * *',
  $$
    delete from auth.users u
    where u.is_anonymous
      and u.created_at < now() - interval '30 days'
      and not exists (select 1 from public.lesson_progress lp where lp.user_id = u.id)
      and not exists (select 1 from public.topic_scores t where t.user_id = u.id)
      and not exists (select 1 from public.saved_items si where si.user_id = u.id)
      and not exists (select 1 from public.mistakes m where m.user_id = u.id)
  $$
);
