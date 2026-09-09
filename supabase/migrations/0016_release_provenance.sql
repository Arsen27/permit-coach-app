-- What produced a release.
--
-- Until now a release recorded only source_version_label, the state package's
-- own name, and the skeleton revision reached the build report on the author's
-- machine and stopped there. A release built from the universal skeleton is the
-- product of three things — the skeleton document, the state package, and the
-- builder — and none of them could be recovered from a release afterwards.
--
-- Free-form on purpose: a release authored in the admin panel has no builder
-- and leaves this null, and the shape will grow (the editor that comes next
-- writes its own revision here). Nothing serves it to the app; it is metadata
-- the panel shows.

alter table public.course_releases
  add column if not exists provenance jsonb;
