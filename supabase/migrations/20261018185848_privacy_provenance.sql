-- Expand first. No content is deleted or copied to a public audit log.
alter table public.entries
  add column revision integer not null default 1 check (revision > 0),
  add column ai_access text not null default 'shared' check (ai_access in ('shared','restricted','private')),
  add column owner_id uuid references auth.users(id),
  add column original_text text,
  add column origin_chat_id text,
  add column origin_chat_title text,
  add column origin_chat_url text,
  add column agent_id uuid,
  add column external_id text;

alter table public.entries disable trigger entries_set_updated_at;
update public.entries e set owner_id = u.id
from auth.users u join public.members m on lower(m.email) = lower(u.email)
where e.owner_id is null and (select count(*) from auth.users u2 join public.members m2 on lower(m2.email)=lower(u2.email)) = 1;
update public.entries set ai_access='private' where id='86a4b8dc-bb95-477f-9664-8badbcaea50a';
alter table public.entries enable trigger entries_set_updated_at;

do $$ declare t text; c text; begin
  foreach t in array array['areas','entries','versions'] loop
    foreach c in array case when t='entries' then array['source','updated_by'] when t='areas' then array['updated_by'] else array['source'] end loop
      execute format('alter table public.%I drop constraint if exists %I', t, t || '_' || c || '_check');
      execute format('alter table public.%I add constraint %I check (%I in (''claude'',''chatgpt'',''manual'',''cursor'',''grok'',''chloe'',''codex'',''opencode'',''system''))', t, t || '_' || c || '_check', c);
    end loop;
  end loop;
end $$;

drop policy "members manage entries" on public.entries;
create policy "members own or shared entries" on public.entries for all to authenticated
using (public.is_member() and (owner_id is null or owner_id=(select auth.uid())))
with check (public.is_member() and (owner_id is null or owner_id=(select auth.uid())));

create function public.entry_revision_history() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if old.title is distinct from new.title or old.content_md is distinct from new.content_md then
    insert into public.versions(target_table,target_id,previous_title,previous_content,source)
    values ('entries',old.id,old.title,old.content_md,new.updated_by);
  end if;
  new.revision=old.revision+1;
  return new;
end $$;
create trigger entries_revision before update on public.entries for each row execute function public.entry_revision_history();

create function public.edit_entry_atomic(p_id uuid,p_revision integer,p_patch jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare r public.entries; v public.entries;
begin
  select * into r from public.entries where id=p_id for update;
  if not found then raise exception 'Registro não encontrado' using errcode='P0002'; end if;
  if r.revision<>p_revision then raise exception 'Conflito de revisão' using errcode='40001'; end if;
  if exists (select 1 from jsonb_object_keys(p_patch) k where k not in ('area_id','type','title','content_md','tags','pinned','archived','updated_by','starts_at','ends_at','all_day','location','recurrence','due_at','done_at','remind_at','reminded_at','links','image_url','priority','ai_access')) then
    raise exception 'Campo não editável';
  end if;
  v=jsonb_populate_record(r,p_patch);
  update public.entries set area_id=v.area_id,type=v.type,title=v.title,content_md=v.content_md,tags=v.tags,pinned=v.pinned,archived=v.archived,updated_by=v.updated_by,
    starts_at=v.starts_at,ends_at=v.ends_at,all_day=v.all_day,location=v.location,recurrence=v.recurrence,due_at=v.due_at,done_at=v.done_at,
    remind_at=v.remind_at,reminded_at=v.reminded_at,links=v.links,image_url=v.image_url,priority=v.priority,ai_access=v.ai_access where id=p_id;
  return p_id;
end $$;
revoke all on function public.edit_entry_atomic(uuid,integer,jsonb) from public,anon;
grant execute on function public.edit_entry_atomic(uuid,integer,jsonb) to authenticated,service_role;

create function public.search_entries_scoped(q text,p_area_id uuid default null,p_type text default null,p_since timestamptz default null,p_until timestamptz default null,p_limit int default 10,p_offset int default 0,p_ai boolean default true,p_areas uuid[] default null,p_restricted uuid[] default '{}')
returns table(id uuid,area_id uuid,area_slug text,area_name text,type text,title text,content_md text,tags text[],source text,updated_by text,pinned boolean,archived boolean,created_at timestamptz,updated_at timestamptz,starts_at timestamptz,ends_at timestamptz,all_day boolean,location text,recurrence text,due_at timestamptz,done_at timestamptz,remind_at timestamptz,reminded_at timestamptz,links jsonb,image_url text,priority text,revision integer,ai_access text,owner_id uuid,original_text text,origin_chat_id text,origin_chat_title text,origin_chat_url text,agent_id uuid,external_id text,rank real,total_count bigint)
language sql stable security invoker set search_path='' as $$
  with query as (select websearch_to_tsquery('portuguese',q) tsq)
  select e.id,e.area_id,a.slug,a.name,e.type,e.title,e.content_md,e.tags,e.source,e.updated_by,e.pinned,e.archived,e.created_at,e.updated_at,e.starts_at,e.ends_at,e.all_day,e.location,e.recurrence,e.due_at,e.done_at,e.remind_at,e.reminded_at,e.links,e.image_url,e.priority,e.revision,e.ai_access,e.owner_id,e.original_text,e.origin_chat_id,e.origin_chat_title,e.origin_chat_url,e.agent_id,e.external_id,ts_rank(e.search,query.tsq),count(*) over()
  from public.entries e join public.areas a on a.id=e.area_id cross join query
  where e.search @@ query.tsq and not e.archived
    and (p_area_id is null or e.area_id=p_area_id) and (p_type is null or e.type=p_type)
    and (p_since is null or e.created_at>=p_since) and (p_until is null or e.created_at<=p_until)
    and (p_areas is null or e.area_id=any(p_areas))
    and (not p_ai or (e.id<>'86a4b8dc-bb95-477f-9664-8badbcaea50a' and (e.ai_access='shared' or (e.ai_access='restricted' and e.area_id=any(p_restricted)))))
  order by ts_rank(e.search,query.tsq) desc,e.created_at desc limit least(greatest(p_limit,1),1000) offset greatest(p_offset,0);
$$;
revoke all on function public.search_entries_scoped(text,uuid,text,timestamptz,timestamptz,int,int,boolean,uuid[],uuid[]) from public,anon;
grant execute on function public.search_entries_scoped(text,uuid,text,timestamptz,timestamptz,int,int,boolean,uuid[],uuid[]) to authenticated,service_role;

-- SQL plugin compatibility: redact before serialization, including historical callers.
alter function central.registro_json(public.entries,text,integer) rename to registro_json_legacy;
create function central.registro_json(e public.entries,area_slug text,max_chars int) returns jsonb language sql stable set search_path='' as $$
select case when e.ai_access<>'shared' or e.id='86a4b8dc-bb95-477f-9664-8badbcaea50a' then jsonb_build_object('id',e.id,'restrito',true)
else central.registro_json_legacy(e,area_slug,max_chars) || jsonb_build_object('revision',e.revision,'origem',jsonb_build_object('titulo',coalesce(e.origin_chat_title,'origem não informada'),'url',e.origin_chat_url)) end;
$$;
revoke all on all functions in schema central from public,anon,authenticated;
-- Administrative SQL remains an administrative maintenance surface, not a bot identity.
comment on schema central is 'Legado administrativo; integrações de agentes devem migrar para MCP/REST com identidade e concessões próprias.';

-- Keep signatures while removing legacy SQL paths that could bypass AI visibility or claim an author.
do $$ declare f record; body text; definition text; begin
 select pg_get_functiondef('public.search_entries(text,uuid,text,timestamptz,timestamptz,boolean,integer,integer)'::regprocedure) into definition;
 definition=replace(definition,'where e.search @@ query.tsq','where e.ai_access=''shared'' and e.id<>''86a4b8dc-bb95-477f-9664-8badbcaea50a'' and e.search @@ query.tsq');
 execute definition;
 for f in select p.oid,p.proname,p.prosrc,l.lanname from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='central' and p.proname in ('briefing','ler_area','ler_registro','ver_agenda','listar_tarefas','salvar_registro','editar_registro','atualizar_resumo','definir_prioridade','garantir_area') loop
  body=f.prosrc;
  if f.proname in ('briefing','ler_area','ler_registro','ver_agenda','listar_tarefas') then
   body=replace(body,'where e.','where e.ai_access=''shared'' and e.id<>''86a4b8dc-bb95-477f-9664-8badbcaea50a'' and e.');
   body=replace(body,'from public.entries where','from public.entries where ai_access=''shared'' and id<>''86a4b8dc-bb95-477f-9664-8badbcaea50a'' and');
  end if;
  if f.proname in ('salvar_registro','editar_registro','atualizar_resumo','definir_prioridade','garantir_area') then
   body=replace(body,'p_fonte','''system''');
  end if;
  if f.proname in ('editar_registro','definir_prioridade') then
   body=replace(body,'where id = p_id','where ai_access=''shared'' and id = p_id');
  end if;
  execute format('create or replace function %s(%s) returns %s language %I security invoker set search_path='''' as %L',f.oid::regproc,pg_get_function_arguments(f.oid),pg_get_function_result(f.oid),f.lanname,body);
 end loop;
end $$;
revoke all on function central.registro_json_legacy(public.entries,text,integer) from public,anon,authenticated;
