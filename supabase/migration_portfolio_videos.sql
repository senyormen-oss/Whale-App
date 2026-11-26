-- Video files in the portfolio (not only YouTube / Instagram / TikTok links). Run AFTER migration_profile.sql. Idempotent.
-- Files go to their own public bucket, up to 50 MB each (the Supabase free-plan limit per file).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio-videos', 'portfolio-videos', true, 52428800, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update
  set public = true,
      file_size_limit = 52428800,
      allowed_mime_types = array['video/mp4', 'video/webm', 'video/quicktime'];

drop policy if exists "portfolio videos are publicly readable" on storage.objects;
create policy "portfolio videos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'portfolio-videos');

drop policy if exists "users upload portfolio videos to their own folder" on storage.objects;
create policy "users upload portfolio videos to their own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'portfolio-videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete their own portfolio videos" on storage.objects;
create policy "users delete their own portfolio videos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'portfolio-videos' and (storage.foldername(name))[1] = auth.uid()::text);

-- A listing's videos may now also be files from that bucket.
alter table public.specialists drop constraint if exists specialists_videos_check;
alter table public.specialists add constraint specialists_videos_check check (
  public.links_ok(
    videos,
    '^(https://(www\.|m\.|vm\.)?(youtube\.com|youtu\.be|instagram\.com|tiktok\.com)/|https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/portfolio-videos/)',
    8
  )
);

notify pgrst, 'reload schema';
