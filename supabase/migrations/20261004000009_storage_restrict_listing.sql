-- Restrict API-level listing of the editorial-media bucket to admins.
--
-- 20261003000008_storage.sql created "editorial_media_public_read", a SELECT
-- policy on storage.objects for every row with bucket_id = 'editorial-media'
-- and no role restriction. The Storage list/search functions run with the
-- caller's privileges, so that policy let any anonymous client holding only
-- the publishable key enumerate the whole bucket (storage.list()) and
-- discover object paths -- including the analysis/{id}/ and
-- case-studies/{id}/ prefixes of draft content.
--
-- Public image delivery is unaffected: the bucket stays public = true, and
-- /storage/v1/object/public/editorial-media/... is served by Storage after
-- checking only the bucket's public flag, without consulting storage.objects
-- RLS. Images belonging to published content remain directly deliverable by
-- URL; they just can no longer be discovered by listing.
--
-- The admin INSERT/UPDATE/DELETE policies from migration 8 are left as is.
-- The CMS still needs SELECT for listing, upsert, move/copy, remove and
-- signed URLs, so that is granted to admins only.

drop policy if exists "editorial_media_public_read" on storage.objects;

drop policy if exists "editorial_media_admin_select" on storage.objects;

create policy "editorial_media_admin_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'editorial-media' and public.is_admin());
