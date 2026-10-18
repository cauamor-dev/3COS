-- Grok v2: keep identities/history, retire old roles, grant no external capability here.
alter table public.agents add column retired_at timestamptz;
alter table public.agents add column external_active boolean not null default false;
alter table public.agents add column legacy_handles text[] not null default '{}';
update public.agents set handle='clara',name='Clara',role='Coordenação e única ponte Grok com a Central',legacy_handles='{norte}',external_active=true where handle='norte';
update public.agents set handle='tereza',name='Tereza',role='Arquitetura de projetos e QA após construção pelo Cauã',legacy_handles='{forja}',external_active=true where handle='forja';
update public.agents set role='Vendas e marketing; leads e três posts em rascunho',external_active=true where handle='rastro';
update public.agents set role='Carreira, estudos, radar de IA e ideias de projeto',external_active=true where handle='atlas';
update public.agents set retired_at=now(),active=false where handle in ('lume','pulso','prumo','campus');
insert into public.agents(handle,name,platform,role,active) values('teo','Téo','grok','Amigo e apoio à decisão; fora da automação',false) on conflict(handle) do nothing;
update public.automation_schedules set active=false,activation_steps='Histórico do plano v1, substituído pelo time v2. Não é rotina ativa.' where schedule_key like 'observed-grok-%';
insert into public.automation_schedules(schedule_key,title,agent_id,workflow_key,cadence,origin,activation_steps)
select 'grok-v2-'||v.key,v.title,a.id,v.workflow,v.cadence,'grok','Informado pelo Cauã em 18/10; conferir rotina existente. Este cadastro não cria agendamento no Grok.'
from (values
 ('clara-resumos','Clara — resumo de progresso','clara','weekly_review','segunda, quarta e sexta ~17h'),
 ('clara-pendencias','Clara — somente pendências ou prazo em até 3 dias','clara','weekly_review','diariamente ~08h; aviso condicional'),
 ('rastro-leads','Rastro — selecionar leads do e-mail Claude','rastro','axial_lead','segunda ~09h'),
 ('rastro-posts','Rastro — preparar 3 posts em rascunho','rastro','marketing_package','terça ~09h'),
 ('tereza-projeto','Tereza — pacote para Claude Code','tereza','code_demo','quarta ~09h; primeiro 21/10'),
 ('atlas-radar','Atlas — carreira e estudos','atlas','career_review','quinta ~09h; primeiro 22/10')
) v(key,title,handle,workflow,cadence) join public.agents a on a.handle=v.handle on conflict(schedule_key) do nothing;
update public.integration_status set activation_steps='Somente Clara: usar MCP /api/mcp com Bearer individual e área Axial delimitada; testar leitura, acesso negado, escrita e entrega. Rastro/Tereza/Atlas não recebem token. Rotinas nativas consultam a fila; sem wake-up externo comprovado.' where provider='grok';

create function central.only_clara_client() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.source='grok' and not exists(select 1 from public.agents a where a.id=new.agent_id and a.handle='clara' and a.retired_at is null) then
  raise exception 'Somente Clara pode ser cliente Grok da Central' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function central.only_clara_client() from public,anon,authenticated;
create trigger client_grok_bridge before insert or update of source,agent_id on public.integration_clients for each row execute function central.only_clara_client();
update public.integration_clients set revoked_at=now() where source='grok' and agent_id not in(select id from public.agents where handle='clara') and revoked_at is null;

alter table public.work_items add column bridge_agent_id uuid references public.agents(id);
create index work_bridge on public.work_items(bridge_agent_id,status) where bridge_agent_id is not null;
create function central.route_grok_work() returns trigger language plpgsql security invoker set search_path='' as $$
declare a public.agents;
begin
 select * into a from public.agents where id=new.assigned_agent_id;
 if a.retired_at is not null or a.handle='teo' then raise exception 'Agente fora da operação' using errcode='22023'; end if;
 if a.platform='grok' then select id into new.bridge_agent_id from public.agents where handle='clara';
 elsif new.bridge_agent_id is not null then raise exception 'Ponte não permitida para esta plataforma' using errcode='22023'; end if;
 return new;
end $$;
revoke all on function central.route_grok_work() from public,anon,authenticated;
create trigger work_grok_bridge before insert or update of assigned_agent_id,bridge_agent_id on public.work_items for each row execute function central.route_grok_work();
update public.work_items w set bridge_agent_id=(select id from public.agents where handle='clara') where assigned_agent_id in(select id from public.agents where platform='grok' and retired_at is null and handle<>'teo');

-- Owner-only notification inbox. AI clients never read this table.
create table public.notification_preferences (
 owner_id uuid primary key references auth.users(id), in_app boolean not null default true, push boolean not null default false,
 kinds text[] not null default '{reminder,task_assigned,due_soon,overdue,approval,delivery,failure}',
 quiet_start integer not null default 22 check(quiet_start between 0 and 23), quiet_end integer not null default 8 check(quiet_end between 0 and 23),
 lead_minutes integer not null default 60 check(lead_minutes in(15,30,60,180,1440)), updated_at timestamptz not null default now(),
 check(kinds <@ array['reminder','task_assigned','due_soon','overdue','approval','delivery','failure','daily_summary'])
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),event_key text not null,
 kind text not null check(kind in('reminder','task_assigned','due_soon','overdue','approval','delivery','failure','daily_summary')),
 title text not null,body text not null,path text not null check(path like '/%' and path not like '//%'),entry_id uuid references public.entries(id),
 created_at timestamptz not null default now(),read_at timestamptz,
 push_status text not null default 'pending' check(push_status in('pending','sending','sent','failed','skipped','uncertain')),
 push_claim uuid,push_started_at timestamptz,push_detail text,unique(owner_id,event_key)
);
create index notifications_owner_cursor on public.notifications(owner_id,created_at desc,id desc);
create index notifications_push_pending on public.notifications(created_at) where push_status='pending';
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
revoke all on public.notification_preferences,public.notifications from anon,authenticated;
grant all on public.notification_preferences,public.notifications to service_role;
grant select,insert,update on public.notification_preferences to authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
create policy "own notification preferences" on public.notification_preferences for all to authenticated using(public.is_member() and owner_id=(select auth.uid())) with check(public.is_member() and owner_id=(select auth.uid()));
create policy "own notifications read" on public.notifications for select to authenticated using(public.is_member() and owner_id=(select auth.uid()));
create policy "own notifications mark" on public.notifications for update to authenticated using(public.is_member() and owner_id=(select auth.uid())) with check(public.is_member() and owner_id=(select auth.uid()));
insert into public.notification_preferences(owner_id) select u.id from auth.users u join public.members m on lower(m.email)=lower(u.email);
alter table public.push_subscriptions add column owner_id uuid references auth.users(id);
update public.push_subscriptions set owner_id=(select u.id from auth.users u join public.members m on lower(u.email)=lower(m.email) limit 1) where owner_id is null;
drop policy "members manage push subscriptions" on public.push_subscriptions;
create policy "own push devices" on public.push_subscriptions for all to authenticated using(public.is_member() and owner_id=(select auth.uid())) with check(public.is_member() and owner_id=(select auth.uid()));

create function central.enqueue_notice(p_owner uuid,p_key text,p_kind text,p_title text,p_body text,p_path text,p_entry uuid default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_owner is null or not exists(select 1 from auth.users u join public.members m on lower(u.email)=lower(m.email) where u.id=p_owner) then return; end if;
 insert into public.notification_preferences(owner_id) values(p_owner) on conflict do nothing;
 insert into public.notifications(owner_id,event_key,kind,title,body,path,entry_id)
 select p_owner,p_key,p_kind,left(p_title,200),left(p_body,500),p_path,p_entry from public.notification_preferences p
 where p.owner_id=p_owner and p.in_app and p_kind=any(p.kinds)
 on conflict(owner_id,event_key) do nothing;
end $$;
revoke all on function central.enqueue_notice(uuid,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function central.enqueue_notice(uuid,text,text,text,text,text,uuid) to service_role;

create function central.work_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.entries;
begin
 select * into e from public.entries where id=new.entry_id;
 if tg_op='INSERT' then
  if exists(select 1 from public.agents where id=new.assigned_agent_id and handle='caua') then
   perform central.enqueue_notice(e.owner_id,'assigned:'||e.id,'task_assigned','Nova tarefa para você',e.title,'/registros/'||e.id,e.id);
  end if;
 elsif new.status is distinct from old.status and new.status in('delivered','failed','blocked') then
  perform central.enqueue_notice(e.owner_id,'work:'||e.id||':'||new.revision,case when new.status='delivered' then 'delivery' else 'failure' end,case when new.status='delivered' then 'Entrega disponível' else 'Trabalho precisa de atenção' end,e.title,'/equipe',e.id);
 end if;
 return new;
end $$;
revoke all on function central.work_notice() from public,anon,authenticated;
create trigger work_notification after insert or update of status on public.work_items for each row execute function central.work_notice();
create function central.approval_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.entries;
begin
 select * into e from public.entries where id=new.entry_id;
 perform central.enqueue_notice(e.owner_id,'approval:'||new.id,'approval','Aguardando seu ok',e.title,'/equipe',e.id);
 return new;
end $$;
revoke all on function central.approval_notice() from public,anon,authenticated;
create trigger approval_notification after insert on public.action_approvals for each row execute function central.approval_notice();

create function central.task_notice() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.type='tarefa' and new.source='manual' then
  perform central.enqueue_notice(new.owner_id,'task:'||new.id,'task_assigned','Tarefa criada',new.title,'/registros/'||new.id,new.id);
 end if;
 return new;
end $$;
revoke all on function central.task_notice() from public,anon,authenticated;
create trigger entry_task_notification after insert on public.entries for each row execute function central.task_notice();

-- Produces notices only. Delivery is an authenticated bounded server operation.
create function public.collect_notifications(p_now timestamptz default now()) returns integer language plpgsql security invoker set search_path='' as $$
declare e public.entries;n int:=0;next_time timestamptz;local_day text;
begin
 perform pg_advisory_xact_lock(3366003);
 local_day=to_char(p_now at time zone 'America/Sao_Paulo','YYYY-MM-DD');
 for e in select * from public.entries where owner_id is not null and not archived and done_at is null and remind_at<=p_now and (reminded_at is null or reminded_at<remind_at) order by remind_at for update skip locked limit 100 loop
  perform central.enqueue_notice(e.owner_id,'reminder:'||e.id||':'||e.remind_at,'reminder','Lembrete',e.title,'/registros/'||e.id,e.id);
  if e.recurrence is null then update public.entries set reminded_at=p_now where id=e.id;
  else
   next_time=e.remind_at;
   while next_time<=p_now loop
    next_time=case e.recurrence when 'diaria' then ((next_time at time zone 'America/Sao_Paulo')+interval '1 day') at time zone 'America/Sao_Paulo' when 'semanal' then next_time+interval '7 days' when 'mensal' then ((next_time at time zone 'America/Sao_Paulo')+interval '1 month') at time zone 'America/Sao_Paulo' else next_time+interval '1 year' end;
   end loop;
   update public.entries set remind_at=next_time,reminded_at=null where id=e.id;
  end if;
  n=n+1;
 end loop;
 for e in select x.* from public.entries x join public.notification_preferences p on p.owner_id=x.owner_id where not x.archived and x.done_at is null and x.type='tarefa' and x.due_at is not null and x.due_at<=p_now+make_interval(mins=>p.lead_minutes) order by x.due_at limit 200 loop
  if e.due_at<p_now then
   perform central.enqueue_notice(e.owner_id,'overdue:'||e.id||':'||e.due_at||':'||local_day,'overdue','Tarefa atrasada',e.title,'/registros/'||e.id,e.id);
  else
   perform central.enqueue_notice(e.owner_id,'due:'||e.id||':'||e.due_at,'due_soon','Prazo se aproximando',e.title,'/registros/'||e.id,e.id);
  end if;
 end loop;
 return n;
end $$;
revoke all on function public.collect_notifications(timestamptz) from public,anon,authenticated;
grant execute on function public.collect_notifications(timestamptz) to service_role;

create function public.claim_notification_push(p_now timestamptz default now()) returns setof public.notifications language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(3366004);
 update public.notifications set push_status='uncertain',push_detail='Sem recibo; verifique antes de reenviar.' where push_status='sending' and push_started_at<p_now-interval '2 minutes';
 update public.notifications n set push_status='skipped' where n.push_status='pending' and (n.created_at<p_now-interval '1 day' or n.read_at is not null or not exists(select 1 from public.notification_preferences p where p.owner_id=n.owner_id and p.push and n.kind=any(p.kinds)));
 return query with picked as (
  select n.id from public.notifications n join public.notification_preferences p on p.owner_id=n.owner_id
  where n.push_status='pending' and p.push and n.kind=any(p.kinds)
   and not(case when p.quiet_start=p.quiet_end then false when p.quiet_start<p.quiet_end then extract(hour from p_now at time zone 'America/Sao_Paulo')>=p.quiet_start and extract(hour from p_now at time zone 'America/Sao_Paulo')<p.quiet_end else extract(hour from p_now at time zone 'America/Sao_Paulo')>=p.quiet_start or extract(hour from p_now at time zone 'America/Sao_Paulo')<p.quiet_end end)
  order by n.created_at for update of n skip locked limit 10
 ) update public.notifications n set push_status='sending',push_claim=gen_random_uuid(),push_started_at=p_now from picked where n.id=picked.id returning n.*;
end $$;
revoke all on function public.claim_notification_push(timestamptz) from public,anon,authenticated;
grant execute on function public.claim_notification_push(timestamptz) to service_role;

create function public.queue_daily_notice(p_now timestamptz default now()) returns void language plpgsql security invoker set search_path='' as $$
declare u record;
begin
 for u in select a.id from auth.users a join public.members m on lower(a.email)=lower(m.email) loop
  perform central.enqueue_notice(u.id,'daily:'||to_char(p_now at time zone 'America/Sao_Paulo','YYYY-MM-DD'),'daily_summary','Seu dia na Central','Consulte agenda, tarefas e próximos passos.','/agenda');
 end loop;
end $$;
revoke all on function public.queue_daily_notice(timestamptz) from public,anon,authenticated;
grant execute on function public.queue_daily_notice(timestamptz) to service_role;

create function public.decide_approvals_batch(p_owner uuid,p_items jsonb,p_approve boolean) returns integer language plpgsql security invoker set search_path='' as $$
declare item jsonb;a public.action_approvals;n int:=0;
begin
 if jsonb_array_length(p_items) not between 1 and 20 then raise exception 'Selecione de 1 a 20 peças'; end if;
 for item in select value from jsonb_array_elements(p_items) order by value->>'id' loop
  select * into a from public.action_approvals where id=(item->>'id')::uuid for update;
  if not found or a.status<>'pending' or a.expires_at<=now() or a.payload_hash<>item->>'payload_hash' or not exists(select 1 from public.entries e where e.id=a.entry_id and e.owner_id=p_owner) then raise exception 'Seleção alterada, vencida ou não autorizada' using errcode='40001'; end if;
  update public.action_approvals set status=case when p_approve then 'approved' else 'rejected' end,approved_by=p_owner where id=a.id;
  n=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.decide_approvals_batch(uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.decide_approvals_batch(uuid,jsonb,boolean) to service_role;

-- The bridge claims work while the business owner remains visible.
create or replace function public.claim_work(p_client text,p_agent uuid,p_areas uuid[],p_provider text,p_entry uuid default null,p_workflows text[] default null)
returns setof public.work_runs language plpgsql security invoker set search_path='' as $$
declare w public.work_items; r public.work_runs; attempts int;
begin
 perform pg_advisory_xact_lock(3366001);
 if (select paused from public.execution_control where id) then return; end if;
 update public.work_runs set status='expired',finished_at=now(),error_code='lease_expired' where status='running' and lease_expires_at<=now();
 update public.work_items i set status=case when (select count(*) from public.work_runs r2 where r2.entry_id=i.entry_id)>=3 then 'failed' else 'queued' end,available_at=now()+interval '30 seconds',last_error='Posse expirada; aguardando retomada.' where status='running' and not exists(select 1 from public.work_runs r2 where r2.entry_id=i.entry_id and r2.status='running');
 if (select count(*) from public.work_runs where status='running')>=2 or exists(select 1 from public.work_runs where status='running' and provider=p_provider) then return; end if;
 select i.* into w from public.work_items i join public.entries e on e.id=i.entry_id join public.agents a on a.id=coalesce(i.bridge_agent_id,i.assigned_agent_id)
 where i.status in ('queued','waiting_executor') and i.available_at<=now() and coalesce(i.bridge_agent_id,i.assigned_agent_id)=p_agent and a.active
  and (p_entry is null or i.entry_id=p_entry) and i.area_id=any(p_areas) and e.ai_access='shared' and not e.archived
  and (p_workflows is null or i.workflow_key=any(p_workflows))
  and not exists(select 1 from unnest(i.depends_on) d where not exists(select 1 from public.work_items dep where dep.entry_id=d and dep.status='delivered'))
  and (i.workflow_key<>'code_demo' or not exists(select 1 from public.work_items other where other.workflow_key='code_demo' and other.status='running'))
 order by i.available_at,i.created_at for update of i skip locked limit 1;
 if not found then return; end if;
 select count(*)+1 into attempts from public.work_runs where entry_id=w.entry_id;
 if attempts>3 then update public.work_items set status='failed',last_error='Limite de tentativas atingido' where entry_id=w.entry_id; return; end if;
 insert into public.work_runs(entry_id,step_key,attempt,executor_client_id,provider) values(w.entry_id,w.current_step,attempts,p_client,p_provider) returning * into r;
 update public.work_items set status='running',revision=revision+1,updated_at=now() where entry_id=w.entry_id;
 insert into public.run_events(run_id,kind,summary) values(r.id,'claimed','Posse adquirida com prazo e fencing token.');
 return next r;
end $$;

