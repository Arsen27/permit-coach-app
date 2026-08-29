-- Sign artwork moves into the content database with the catalogue it belongs
-- to. content_assets was created ahead of it holding only metadata; the bytes
-- go in now, and the two checks make a file stored under the wrong id
-- impossible. Files are content-addressed: the id is the sha256 of the bytes,
-- so a picture is immutable, its URL never changes, and replacing one produces
-- a different id rather than a poisoned cache.
--
-- The pixel dimensions were speculative and nothing reads them; a picture's
-- size is a property of the picture, and the app has never asked the server
-- for it.
alter table public.content_assets drop column if exists width;
alter table public.content_assets drop column if exists height;
alter table public.content_assets add column if not exists bytes bytea;

-- Nothing has been stored yet, so the column can become required outright.
delete from public.content_assets where bytes is null;
alter table public.content_assets alter column bytes set not null;

alter table public.content_assets
  drop constraint if exists content_assets_size_bytes_check;
alter table public.content_assets
  add constraint content_assets_size check (size_bytes = octet_length(bytes));
alter table public.content_assets
  add constraint content_assets_hash
  check (sha256 = encode(pg_catalog.sha256(bytes), 'hex'));
