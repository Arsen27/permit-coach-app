-- Release instructions were stored as a JSON *string* rather than an array.
--
-- The insert binds JSON text and casts it: `$n::jsonb`. PGlite sends a string
-- parameter as text, so the cast parses it and the column holds an array —
-- which is what every test saw. The driver production runs on sends the same
-- parameter as JSON, so the cast wrapped it instead, and the column held one
-- long string. The server read it back, JSON.parse gave the string again, and
-- bootstrap handed the app `instructions: "[{...}]"` where the wire format
-- says array. The app validates before it acts, so it refused the whole
-- answer: every install and every update failed with nothing to point at.
--
-- The write now casts through text (`$n::text::jsonb`), which both drivers
-- agree on. This repairs what the old form wrote.

update public.course_releases
set instructions = (instructions #>> '{}')::jsonb
where jsonb_typeof(instructions) = 'string';
