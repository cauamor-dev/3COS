alter table public.entries add column origin_client_id text;
create unique index entries_external_idempotency on public.entries(origin_client_id,external_id) nulls not distinct where external_id is not null;
alter table public.versions add column previous_snapshot jsonb;
create or replace function public.entry_revision_history() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (to_jsonb(old)-array['updated_at','revision','search']) is distinct from (to_jsonb(new)-array['updated_at','revision','search']) then
  insert into public.versions(target_table,target_id,previous_title,previous_content,previous_snapshot,source)
  values('entries',old.id,old.title,old.content_md,to_jsonb(old)-'search',new.updated_by);
 end if;
 new.revision=old.revision+1;return new;
end $$;
drop policy "members manage versions" on public.versions;
create policy "versions target access" on public.versions for all to authenticated
using(public.is_member() and (target_table='areas' or exists(select 1 from public.entries e where e.id=target_id)))
with check(public.is_member() and (target_table='areas' or exists(select 1 from public.entries e where e.id=target_id)));

create function public.consume_approval_with_lease(p_id uuid,p_hash text,p_run uuid,p_client text,p_lease uuid,p_fence bigint)
returns public.action_approvals language plpgsql security invoker set search_path='' as $$
declare r public.work_runs;w public.work_items;a public.action_approvals;
begin
 select * into r from public.work_runs where id=p_run for update;
 if not found or r.executor_client_id<>p_client or r.lease_token<>p_lease or r.fencing_token<>p_fence or r.status<>'running' or r.lease_expires_at<=now() then raise exception 'Posse inválida ou vencida' using errcode='42501'; end if;
 select * into w from public.work_items where entry_id=r.entry_id for update;
 if w.status<>'running' or (select paused from public.execution_control where id) then raise exception 'Execução pausada ou cancelada' using errcode='42501'; end if;
 select * into a from public.action_approvals where id=p_id for update;
 if not found or a.entry_id<>w.entry_id or a.status<>'approved' or a.expires_at<=now() or a.payload_hash<>p_hash or a.consumed_at is not null then raise exception 'Aprovação alterada, vencida ou já utilizada' using errcode='42501'; end if;
 update public.action_approvals set status='consuming',consumed_at=now() where id=p_id returning * into a;
 return a;
end $$;
revoke all on function public.consume_approval_with_lease(uuid,text,uuid,text,uuid,bigint) from public,anon,authenticated;
grant execute on function public.consume_approval_with_lease(uuid,text,uuid,text,uuid,bigint) to service_role;

-- Account for legacy objects too; keep a conservative local cap and room for ordinary Central usage.
create or replace function public.reserve_artifact(p_owner uuid,p_entry uuid,p_area uuid,p_name text,p_mime text,p_size bigint,p_path text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;allocated bigint;pending bigint;
begin
 perform pg_advisory_xact_lock(3366002);
 select coalesce(sum((metadata->>'size')::bigint),0) into allocated from storage.objects where bucket_id='arquivos';
 select coalesce(sum(size_bytes),0) into pending from public.artifacts where status='reserved' and reservation_expires_at>now();
 if p_size<=0 or p_size>(case when p_mime='video/mp4' then 52428800 else 10485760 end) or allocated+pending+p_size>314572800 then raise exception 'Sem reserva de armazenamento'; end if;
 insert into public.artifacts(owner_id,entry_id,area_id,name,mime,size_bytes,object_path,visibility,reservation_expires_at)
 values(p_owner,p_entry,p_area,p_name,p_mime,p_size,p_path,case when p_entry is null then 'private' else 'shared' end,now()+interval '2 hours') returning id into result;
 return result;
end $$;
