-- Storage architecture (docs/MKTBD_SPEC.md sections 11 and 15).
--
-- A single public bucket holds all public editorial imagery: Analysis
-- carousel slides and Case Study cover images. Nothing paid (the Case
-- Study PDF) is ever uploaded here -- fulfilment stays manual in V1.
--
-- Conventional paths (enforced by the Admin upload flow in a future
-- prompt, not by the database):
--   analysis/{analysis_id}/{position}-{filename}
--   case-studies/{case_study_id}/cover.{ext}
--
-- Assumes the storage.buckets/storage.objects tables already exist, which
-- they do on any real Supabase project (local or hosted) -- this is Supabase
-- platform schema, not something this project creates.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'editorial-media',
  'editorial-media',
  true,
  5242880, -- 5 MB per file. Revisit if source carousel art needs more; the
           -- limit is enforced by Storage itself, not just the app layer.
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Public bucket => direct-download GETs (/storage/v1/object/public/...)
-- already bypass RLS entirely, but an explicit SELECT policy is still
-- needed for API-level access (e.g. supabase-js storage.list(), or
-- generating URLs from the Admin UI).
create policy "editorial_media_public_read"
  on storage.objects for select
  using (bucket_id = 'editorial-media');

create policy "editorial_media_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'editorial-media' and public.is_admin());

create policy "editorial_media_admin_update"
  on storage.objects for update
  using (bucket_id = 'editorial-media' and public.is_admin())
  with check (bucket_id = 'editorial-media' and public.is_admin());

create policy "editorial_media_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'editorial-media' and public.is_admin());
