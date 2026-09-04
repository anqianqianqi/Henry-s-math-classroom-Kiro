-- Generated panel art is stored separately so one panel can be revised without
-- regenerating or replacing a complete comic page.

insert into storage.buckets (id, name, public)
values ('manga-panels', 'manga-panels', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "manga_panels_public_read" on storage.objects;
create policy "manga_panels_public_read"
on storage.objects for select
using (bucket_id = 'manga-panels');

-- Uploads are performed only by the server-side service-role client after the
-- manga admin authorization check. No direct browser insert policy is granted.
