-- Draft bodies must round-trip byte for byte: a release rebuilds the served
-- documents from a draft and compares their hashes with the base version, so
-- an untouched lesson has to serialise to exactly the bytes it was read with.
-- jsonb normalises key order and would make every untouched document look
-- edited; json keeps the text as written.
alter table public.course_drafts
  alter column course type json using course::text::json;
alter table public.course_draft_entities
  alter column body type json using body::text::json;
alter table public.course_draft_archive
  alter column contents type json using contents::text::json;
