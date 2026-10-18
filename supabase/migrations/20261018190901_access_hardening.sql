revoke all on function public.is_member() from public,anon;
grant execute on function public.is_member() to authenticated,service_role;
revoke all on function public.keep_deleted_row() from public,anon,authenticated;
revoke all on function public.entry_revision_history() from public,anon,authenticated;

-- A second member must not inherit another member's personal work through its extension tables.
drop policy "member read" on public.work_items;
create policy "work entry access" on public.work_items for select to authenticated using(public.is_member() and exists(select 1 from public.entries e where e.id=entry_id));
drop policy "member read" on public.work_runs;
create policy "run entry access" on public.work_runs for select to authenticated using(public.is_member() and exists(select 1 from public.entries e where e.id=entry_id));
drop policy "member read" on public.action_approvals;
create policy "approval entry access" on public.action_approvals for select to authenticated using(public.is_member() and exists(select 1 from public.entries e where e.id=entry_id));
drop policy "member read" on public.run_events;
create policy "event entry access" on public.run_events for select to authenticated using(public.is_member() and exists(select 1 from public.work_runs r join public.entries e on e.id=r.entry_id where r.id=run_id));

create table public.client_rate_windows(client_id text not null,window_start timestamptz not null,calls integer not null default 0,primary key(client_id,window_start));
alter table public.client_rate_windows enable row level security;
revoke all on public.client_rate_windows from public,anon,authenticated;
grant all on public.client_rate_windows to service_role;
create function public.check_client_quota(p_client text) returns boolean language plpgsql security invoker set search_path='' as $$
declare minute_calls integer;daily_calls integer;
begin
 perform pg_advisory_xact_lock(hashtext('client-quota:'||p_client));
 select coalesce(sum(calls),0) into daily_calls from public.client_rate_windows where client_id=p_client and window_start>=date_trunc('day',now());
 select calls into minute_calls from public.client_rate_windows where client_id=p_client and window_start=date_trunc('minute',now());
 if daily_calls>=1000 or coalesce(minute_calls,0)>=60 then return false; end if;
 insert into public.client_rate_windows(client_id,window_start,calls) values(p_client,date_trunc('minute',now()),1) on conflict(client_id,window_start) do update set calls=client_rate_windows.calls+1;
 return true;
end $$;
revoke all on function public.check_client_quota(text) from public,anon,authenticated;
grant execute on function public.check_client_quota(text) to service_role;

create function public.cancel_work(p_entry uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.work_items set status='cancelled',revision=revision+1,updated_at=now() where entry_id=p_entry and status<>'delivered';
 update public.work_runs set status='cancelled',finished_at=now() where entry_id=p_entry and status='running';
end $$;
revoke all on function public.cancel_work(uuid) from public,anon,authenticated;
grant execute on function public.cancel_work(uuid) to service_role;
