-- Durable third-party erasure queue.
--
-- Supabase can atomically delete its own rows, but PostHog and RevenueCat are
-- external systems. Recording the job in the same transaction as auth.users
-- deletion means a lost phone connection cannot turn account deletion into a
-- permanently partial best-effort operation. The Railway server claims these
-- rows through the service role and retries idempotent provider deletions.

create table public.account_erasure_jobs (
  user_id uuid primary key,
  reason text not null check (reason in ('user_request', 'stale_anonymous')),
  requested_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  attempt_count int not null default 0 check (attempt_count >= 0),
  locked_at timestamptz,
  claim_token uuid,
  posthog_erased_at timestamptz,
  revenuecat_erased_at timestamptz,
  last_error text
);

alter table public.account_erasure_jobs enable row level security;

-- No mobile client may read or mutate the queue. The service-role key lives
-- only on Railway and bypasses RLS; explicit grants also make the table
-- available through PostgREST to that role.
revoke all on public.account_erasure_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.account_erasure_jobs to service_role;

-- Replace the original account-deletion RPC. Queue insertion and the
-- auth.users deletion are one database transaction: either both happen or
-- neither does. Cascades still erase all PermitCoach-owned profile/progress
-- rows immediately.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.account_erasure_jobs as jobs (user_id, reason)
  values (uid, 'user_request')
  on conflict (user_id) do update set
    reason = 'user_request',
    requested_at = least(jobs.requested_at, excluded.requested_at),
    next_attempt_at = least(jobs.next_attempt_at, excluded.next_attempt_at),
    locked_at = null,
    claim_token = null;

  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- Atomically claim due work. SKIP LOCKED plus a per-claim token lets multiple
-- Railway instances run safely. A crashed worker's lock becomes claimable
-- again after ten minutes.
create function public.claim_account_erasure_jobs(
  p_max_jobs integer default 10,
  p_user_id uuid default null
)
returns table (
  user_id uuid,
  reason text,
  requested_at timestamptz,
  attempt_count integer,
  claim_token uuid,
  posthog_erased_at timestamptz,
  revenuecat_erased_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  with candidates as materialized (
    select jobs.user_id
    from public.account_erasure_jobs jobs
    where jobs.next_attempt_at <= now()
      and (jobs.locked_at is null or jobs.locked_at < now() - interval '10 minutes')
      and (p_user_id is null or jobs.user_id = p_user_id)
    order by jobs.requested_at
    for update skip locked
    limit greatest(1, least(coalesce(p_max_jobs, 10), 50))
  ), claimed as (
    update public.account_erasure_jobs jobs
    set locked_at = now(),
        claim_token = gen_random_uuid(),
        attempt_count = jobs.attempt_count + 1,
        last_error = null
    from candidates
    where jobs.user_id = candidates.user_id
    returning jobs.*
  )
  select
    claimed.user_id,
    claimed.reason,
    claimed.requested_at,
    claimed.attempt_count,
    claimed.claim_token,
    claimed.posthog_erased_at,
    claimed.revenuecat_erased_at
  from claimed;
$$;

revoke execute on function public.claim_account_erasure_jobs(integer, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_account_erasure_jobs(integer, uuid)
  to service_role;

-- Replace the old cron command without editing migration 0002. In addition to
-- question_stats, the eligibility check covers profile-only progress and
-- never deletes an active Plus customer. Jobs are queued before auth rows are
-- removed, in the same SQL statement.
do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid from cron.job where jobname = 'cleanup-stale-anon-users'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;
end;
$$;

select cron.schedule(
  'cleanup-stale-anon-users',
  '0 3 * * *',
  $cron$
    with stale as materialized (
      select u.id
      from auth.users u
      join public.profiles p on p.id = u.id
      where u.is_anonymous
        and greatest(
          u.created_at,
          coalesce(u.last_sign_in_at, u.created_at),
          p.updated_at
        ) < now() - interval '30 days'
        and p.plan = 'free'
        and p.best_exam is null
        and p.current_streak = 0
        and p.longest_streak = 0
        and p.days_studied = 0
        and not exists (
          select 1 from public.lesson_progress lp where lp.user_id = u.id
        )
        and not exists (
          select 1 from public.topic_scores ts where ts.user_id = u.id
        )
        and not exists (
          select 1 from public.question_stats qs where qs.user_id = u.id
        )
        and not exists (
          select 1 from public.saved_items si where si.user_id = u.id
        )
        and not exists (
          select 1 from public.mistakes m where m.user_id = u.id
        )
      for update of u skip locked
    ), queued as (
      insert into public.account_erasure_jobs as jobs (user_id, reason)
      select stale.id, 'stale_anonymous'
      from stale
      on conflict (user_id) do update set
        requested_at = least(jobs.requested_at, excluded.requested_at),
        next_attempt_at = least(jobs.next_attempt_at, excluded.next_attempt_at),
        locked_at = null,
        claim_token = null
      returning user_id
    )
    delete from auth.users u
    using queued
    where u.id = queued.user_id
  $cron$
);
