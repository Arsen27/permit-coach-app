-- The same fault as 0010, in every other json column.
--
-- Writes bound JSON text and cast it with `$n::json`. The driver production
-- runs on sends a string parameter as JSON, so the cast wrapped the text
-- instead of parsing it: the column held one long string. PGlite, which the
-- tests use, sends that parameter as text and the cast parses it — so no test
-- ever saw the shape production had.
--
-- For drafts the symptom was a draft that opened empty: the panel parsed the
-- column, got a string where a course was promised, and found no modules on it
-- to list. Every write now casts through text, which both drivers read alike.

update public.course_drafts
set course = (course #>> '{}')::json
where json_typeof(course) = 'string';

update public.course_draft_entities
set body = (body #>> '{}')::json
where json_typeof(body) = 'string';

update public.course_draft_archive
set contents = (contents #>> '{}')::json
where json_typeof(contents) = 'string';

update public.admin_settings
set settings = (settings #>> '{}')::jsonb
where jsonb_typeof(settings) = 'string';
