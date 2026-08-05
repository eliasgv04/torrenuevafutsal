-- Torrenueva Futsal: RLS policies for the "photos" storage bucket.
-- Without these, storage.objects has RLS enabled but zero policies, so every
-- upload from the app (authenticated session) is silently rejected and api.js
-- falls back to embedding the image as a base64 data URL directly in the row
-- (exercises.photo_url, teams.crest_url) instead of a real Storage URL.
-- Run this in the Supabase SQL editor if you're not applying it via the CLI.

drop policy if exists "Authenticated can read photos" on storage.objects;
create policy "Authenticated can read photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'photos');

drop policy if exists "Public can read photos" on storage.objects;
create policy "Public can read photos"
  on storage.objects for select
  to anon
  using (bucket_id = 'photos');

drop policy if exists "Authenticated can upload photos" on storage.objects;
create policy "Authenticated can upload photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'photos');

drop policy if exists "Authenticated can update photos" on storage.objects;
create policy "Authenticated can update photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'photos')
  with check (bucket_id = 'photos');

drop policy if exists "Authenticated can delete photos" on storage.objects;
create policy "Authenticated can delete photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'photos');
