-- Supabase stops auto-granting Data API access to new public tables on 2026-10-30.
-- Grant explicitly so a fresh project replaying these migrations works the same way.
-- RLS still decides which rows each role can see.

revoke all on public.members, public.areas, public.entries, public.versions, public.trash from anon;

grant select on public.members to authenticated;
grant select, insert, update, delete on public.areas, public.entries, public.versions to authenticated;
grant select on public.trash to authenticated;

grant select, insert, update, delete on public.members, public.areas, public.entries, public.versions, public.trash
  to service_role;

revoke execute on function public.search_entries(text, uuid, text, timestamptz, timestamptz, boolean, int, int) from anon;
grant execute on function public.search_entries(text, uuid, text, timestamptz, timestamptz, boolean, int, int)
  to authenticated, service_role;
grant execute on function public.is_member() to authenticated, service_role;
