-- Private bucket for images and files saved by the user (app, Telegram) and by the AIs.
-- Only the member can read, upload or delete; links handed out are signed.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'arquivos',
  'arquivos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/pdf', 'text/plain']
)
on conflict (id) do nothing;

create policy "membros leem arquivos" on storage.objects
  for select to authenticated using (bucket_id = 'arquivos' and public.is_member());

create policy "membros enviam arquivos" on storage.objects
  for insert to authenticated with check (bucket_id = 'arquivos' and public.is_member());

create policy "membros apagam arquivos" on storage.objects
  for delete to authenticated using (bucket_id = 'arquivos' and public.is_member());
