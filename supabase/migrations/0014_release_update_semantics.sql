-- What a release means for devices already in the field.
--
-- The redesign's update taxonomy: a release is either a fix — devices on the
-- versions it replaces take it wholesale, silently or with a yellow-marked
-- notice — or a course update, which existing users are offered (or never
-- shown, if it is for new users only). `replaces` limits a fix to named
-- versions; null means every version sharing the first two digits.
-- `changed_lessons` is computed at release time from document hashes, and is
-- what the app marks yellow; null means "unknown — treat everything as
-- changed", which is also right for the releases that predate this column.

alter table public.course_releases
  add column if not exists update_kind text not null default 'fix'
    check (update_kind in ('fix', 'course')),
  add column if not exists update_subtype text not null default 'silent'
    check (update_subtype in ('silent', 'apology', 'rules', 'new_users', 'offer')),
  add column if not exists replaces jsonb,
  add column if not exists changed_lessons jsonb,
  add column if not exists update_message text not null default '';
