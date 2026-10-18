create table public.agents (
 id uuid primary key default gen_random_uuid(), handle text not null unique, name text not null, platform text not null,
 role text not null, instruction_version integer not null default 1, active boolean not null default false,
 capabilities text[] not null default '{}', limits jsonb not null default '{"handoffs":2,"reviews":1}', created_at timestamptz not null default now()
);
create table public.integration_clients (
 id uuid primary key default gen_random_uuid(), name text not null, token_hash text not null unique, token_prefix text not null,
 owner_id uuid not null references auth.users(id),
 agent_id uuid not null references public.agents(id), source text not null check(source in ('claude','chatgpt','grok','chloe','codex','cursor','opencode','system')),
 expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now()
);
create table public.client_area_grants (
 client_id uuid not null references public.integration_clients(id), area_id uuid not null references public.areas(id),
 operations text[] not null default '{read}', restricted boolean not null default false,
 primary key(client_id,area_id), check(operations <@ array['read','write','files','team','execute'])
);
create table public.team_threads (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 200), area_id uuid references public.areas(id),
 owner_id uuid references auth.users(id), visibility text not null default 'shared' check(visibility in ('shared','personal')),
 participants uuid[] not null default '{}', entry_id uuid references public.entries(id), created_at timestamptz not null default now()
);
create table public.team_messages (
 id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.team_threads(id), actor_id text not null,
 agent_id uuid references public.agents(id), source text not null, body text not null check(length(body) between 1 and 20000),
 reply_to uuid references public.team_messages(id), entry_id uuid references public.entries(id), origin_chat_title text, origin_chat_url text,
 refs jsonb not null default '[]', idempotency_key text not null, created_at timestamptz not null default now(),
 unique(actor_id,idempotency_key)
);
create index team_messages_cursor on public.team_messages(thread_id,created_at desc,id desc);
create table public.work_items (
 entry_id uuid primary key references public.entries(id), area_id uuid not null references public.areas(id), workflow_key text not null,
 workflow_version integer not null default 1, assigned_agent_id uuid not null references public.agents(id),
 status text not null default 'queued' check(status in ('queued','running','waiting_executor','waiting_approval','blocked','delivered','failed','cancelled')),
 objective text not null, input_refs jsonb not null default '[]', expected_output text not null, acceptance_criteria text not null,
 allowed_actions text[] not null default '{read,prepare}', available_at timestamptz not null default now(), due_at timestamptz,
 depends_on uuid[] not null default '{}', current_step text not null default 'prepare', revision integer not null default 1,
 idempotency_key text not null, created_by text not null, last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(created_by,idempotency_key), check(not entry_id=any(depends_on)), check(allowed_actions <@ array['read','prepare','code','render','central_release','external_effect'])
);
create index work_queue on public.work_items(available_at,created_at) where status in ('queued','waiting_executor');
create index work_agent on public.work_items(assigned_agent_id,status);
create function public.create_work_atomic(p_client text,p_key text,p_hash text,p_input jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare receipt record; result uuid;
begin
 perform pg_advisory_xact_lock(hashtext(p_client||':work:'||p_key));
 select * into receipt from public.operation_receipts where client_id=p_client and operation='create_work' and idempotency_key=p_key;
 if found then
  if receipt.request_hash<>p_hash then raise exception 'Idempotência com conteúdo diferente' using errcode='23505'; end if;
  return (receipt.result->>'entry_id')::uuid;
 end if;
 insert into public.entries(area_id,type,title,content_md,source,updated_by,owner_id,agent_id,original_text)
 values((p_input->>'area_id')::uuid,'tarefa',left(p_input->>'objective',200),p_input->>'objective',p_input->>'source',p_input->>'source',(p_input->>'owner_id')::uuid,(p_input->>'agent_id')::uuid,p_input->>'objective') returning id into result;
 insert into public.work_items(entry_id,area_id,workflow_key,workflow_version,assigned_agent_id,status,objective,input_refs,expected_output,acceptance_criteria,allowed_actions,due_at,depends_on,current_step,idempotency_key,created_by)
 values(result,(p_input->>'area_id')::uuid,p_input->>'workflow_key',(p_input->>'workflow_version')::int,(p_input->>'assigned_agent_id')::uuid,p_input->>'status',p_input->>'objective',p_input->'input_refs',p_input->>'expected_output',p_input->>'acceptance_criteria',array(select jsonb_array_elements_text(p_input->'allowed_actions')),(p_input->>'due_at')::timestamptz,array(select jsonb_array_elements_text(p_input->'depends_on'))::uuid[],p_input->>'current_step',p_key,p_client);
 insert into public.operation_receipts(client_id,operation,idempotency_key,request_hash,result) values(p_client,'create_work',p_key,p_hash,jsonb_build_object('entry_id',result));
 return result;
end $$;
create sequence public.work_fence_seq;
create table public.work_runs (
 id uuid primary key default gen_random_uuid(), entry_id uuid not null references public.work_items(entry_id), step_key text not null,
 attempt integer not null, executor_client_id text not null, provider text not null, status text not null default 'running',
 lease_token uuid not null default gen_random_uuid(), fencing_token bigint not null default nextval('public.work_fence_seq'),
 lease_expires_at timestamptz not null default now()+interval '90 seconds', heartbeat_at timestamptz not null default now(),
 started_at timestamptz not null default now(), finished_at timestamptz, checkpoint jsonb not null default '{}', input_hash text,
 output_refs jsonb not null default '[]', error_code text, error_summary text, budget_reservation uuid, unique(entry_id,attempt)
);
create index work_runs_lease on public.work_runs(lease_expires_at) where status='running';
create table public.run_events (
 id uuid primary key default gen_random_uuid(), run_id uuid not null references public.work_runs(id), kind text not null, summary text not null,
 created_at timestamptz not null default now()
);
create index run_events_run on public.run_events(run_id,created_at);
create table public.action_approvals (
 id uuid primary key default gen_random_uuid(), entry_id uuid not null references public.work_items(entry_id), action_type text not null,
 target text not null, payload_hash text not null, payload_ref jsonb not null, requested_by text not null, approved_by uuid references auth.users(id),
 status text not null default 'pending' check(status in ('pending','approved','rejected','expired','consuming','succeeded','uncertain','failed')),
 expires_at timestamptz not null default now()+interval '24 hours', consumed_at timestamptz, result_ref text, created_at timestamptz not null default now()
);
create index approvals_work on public.action_approvals(entry_id,status);
create table public.artifacts (
 id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users(id), entry_id uuid references public.entries(id), run_id uuid references public.work_runs(id),
 area_id uuid references public.areas(id), name text not null, mime text not null, size_bytes bigint not null check(size_bytes between 0 and 52428800),
 sha256 text, object_path text unique, external_url text, visibility text not null default 'private' check(visibility in ('shared','private','restricted')),
 status text not null default 'reserved' check(status in ('reserved','ready','rejected')), reservation_expires_at timestamptz,
 created_at timestamptz not null default now(), check(object_path is not null or external_url is not null)
);
create index artifacts_entry on public.artifacts(entry_id);
create index artifacts_owner on public.artifacts(owner_id,created_at desc);
create table public.automation_schedules (
 id uuid primary key default gen_random_uuid(), schedule_key text not null unique, title text not null, agent_id uuid references public.agents(id),
 workflow_key text not null, workflow_version integer not null default 1, timezone text not null default 'America/Sao_Paulo', cadence text not null,
 origin text not null check(origin in ('central','grok','claude','chatgpt','local')), active boolean not null default false,
 verified_at timestamptz, last_run_at timestamptz, next_run_at timestamptz, consumption integer not null default 0,
 activation_steps text not null, created_at timestamptz not null default now()
);
create table public.integration_status (
 provider text primary key, account_alias text not null default 'principal', connection_mode text not null,
 status text not null default 'not_configured' check(status in ('not_configured','configured_unverified','verified','expired','quota_paused','unavailable')),
 capabilities text[] not null default '{}', last_checked_at timestamptz, last_success_at timestamptz, error_code text, activation_steps text not null
);
create table public.usage_daily (
 day date not null, provider text not null, client_id text not null, calls integer not null default 0, reserved_tokens integer not null default 0,
 used_tokens integer not null default 0, failures integer not null default 0, primary key(day,provider,client_id)
);
create table public.usage_reservations (
 id uuid primary key default gen_random_uuid(), day date not null default current_date, provider text not null, client_id text not null,
 tokens integer not null check(tokens>0), status text not null default 'reserved', expires_at timestamptz not null default now()+interval '2 minutes', used_tokens integer
);
create table public.operation_receipts (
 client_id text not null, operation text not null, idempotency_key text not null, request_hash text not null,
 result jsonb, created_at timestamptz not null default now(), primary key(client_id,operation,idempotency_key)
);
create table public.execution_control (id boolean primary key default true check(id), paused boolean not null default true, updated_at timestamptz not null default now());
insert into public.execution_control(id) values(true);

-- Only members see the UI. Secrets, acquisition, effects and quotas remain server-only.
do $$ declare t text; begin
 foreach t in array array['agents','integration_clients','client_area_grants','team_threads','team_messages','work_items','work_runs','run_events','action_approvals','artifacts','automation_schedules','integration_status','usage_daily','usage_reservations','operation_receipts','execution_control'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
 foreach t in array array['agents','work_items','work_runs','run_events','action_approvals','automation_schedules','integration_status','usage_daily','execution_control'] loop
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy "member read" on public.%I for select to authenticated using(public.is_member())',t);
 end loop;
end $$;
grant select on public.team_threads,public.team_messages,public.artifacts to authenticated;
create policy "thread owner" on public.team_threads for select to authenticated using(public.is_member() and (visibility='shared' or owner_id=(select auth.uid())));
create policy "message owner" on public.team_messages for select to authenticated using(exists(select 1 from public.team_threads t where t.id=thread_id and public.is_member() and (t.visibility='shared' or t.owner_id=(select auth.uid()))));
create policy "artifact owner" on public.artifacts for select to authenticated using(public.is_member() and (owner_id=(select auth.uid()) or visibility='shared'));
grant usage,select on sequence public.work_fence_seq to service_role;

create function public.claim_work(p_client text,p_agent uuid,p_areas uuid[],p_provider text,p_entry uuid default null,p_workflows text[] default null)
returns setof public.work_runs language plpgsql security invoker set search_path='' as $$
declare w public.work_items; r public.work_runs; attempts int;
begin
 perform pg_advisory_xact_lock(3366001);
 if (select paused from public.execution_control where id) then return; end if;
 update public.work_runs set status='expired',finished_at=now(),error_code='lease_expired' where status='running' and lease_expires_at<=now();
 update public.work_items i set status=case when (select count(*) from public.work_runs r2 where r2.entry_id=i.entry_id)>=3 then 'failed' else 'queued' end,available_at=now()+interval '30 seconds',last_error='Posse expirada; aguardando retomada.' where status='running' and not exists(select 1 from public.work_runs r2 where r2.entry_id=i.entry_id and r2.status='running');
 if (select count(*) from public.work_runs where status='running')>=2 or exists(select 1 from public.work_runs where status='running' and provider=p_provider) then return; end if;
 select i.* into w from public.work_items i join public.entries e on e.id=i.entry_id join public.agents a on a.id=i.assigned_agent_id
 where i.status in ('queued','waiting_executor') and i.available_at<=now() and i.assigned_agent_id=p_agent and a.active
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

create function public.report_work(p_run uuid,p_client text,p_lease uuid,p_fence bigint,p_status text,p_result jsonb)
returns public.work_runs language plpgsql security invoker set search_path='' as $$
declare r public.work_runs; w public.work_items;
begin
 select * into r from public.work_runs where id=p_run for update;
 if not found or r.executor_client_id<>p_client or r.lease_token<>p_lease or r.fencing_token<>p_fence then raise exception 'Posse inválida' using errcode='42501'; end if;
 if r.status=p_status and r.output_refs=p_result then return r; end if;
 if r.status<>'running' or r.lease_expires_at<=now() then raise exception 'Posse vencida' using errcode='40001'; end if;
 select * into w from public.work_items where entry_id=r.entry_id for update;
 if w.status='cancelled' or (select paused from public.execution_control where id) then raise exception 'Execução pausada ou cancelada' using errcode='42501'; end if;
 if p_status not in ('delivered','failed','blocked','waiting_approval','uncertain') then raise exception 'Estado inválido'; end if;
 if p_status='delivered' and (p_result->>'summary' is null or coalesce(jsonb_array_length(p_result->'evidence'),0)=0) then raise exception 'Entrega exige resumo e evidências'; end if;
 update public.work_runs set status=p_status,output_refs=p_result,finished_at=now() where id=p_run returning * into r;
 update public.work_items set status=case when p_status='uncertain' then 'blocked' else p_status end,current_step=case when p_status='delivered' then 'done' else current_step end,last_error=case when p_status in ('failed','blocked','uncertain') then left(p_result->>'summary',500) end,revision=revision+1,updated_at=now() where entry_id=r.entry_id;
 if p_status='delivered' then update public.entries set done_at=now(),updated_by='system' where id=r.entry_id; end if;
 insert into public.run_events(run_id,kind,summary) values(p_run,p_status,'Resultado recebido; consulte a entrega e suas evidências.');
 return r;
end $$;

create function public.heartbeat_work(p_run uuid,p_client text,p_lease uuid,p_fence bigint,p_checkpoint jsonb default '{}')
returns timestamptz language plpgsql security invoker set search_path='' as $$
declare expiry timestamptz;
begin
 if octet_length(p_checkpoint::text)>8000 then raise exception 'Checkpoint grande demais'; end if;
 update public.work_runs r set lease_expires_at=now()+interval '90 seconds',heartbeat_at=now(),checkpoint=p_checkpoint
 where r.id=p_run and r.executor_client_id=p_client and r.lease_token=p_lease and r.fencing_token=p_fence and r.status='running' and r.lease_expires_at>now()
 and not (select paused from public.execution_control where id) and exists(select 1 from public.work_items w where w.entry_id=r.entry_id and w.status='running') returning r.lease_expires_at into expiry;
 if expiry is null then raise exception 'Posse vencida ou execução pausada' using errcode='40001'; end if;
 return expiry;
end $$;

create function public.reserve_usage(p_provider text,p_client text,p_tokens int,p_call_limit int default 100,p_token_limit int default 100000)
returns uuid language plpgsql security invoker set search_path='' as $$
declare reservation uuid; calls int; tokens int; expired public.usage_reservations;
begin
 perform pg_advisory_xact_lock(hashtext('usage:'||p_provider));
 for expired in select * from public.usage_reservations where provider=p_provider and status='reserved' and expires_at<=now() for update loop
  update public.usage_daily set reserved_tokens=greatest(0,reserved_tokens-expired.tokens) where day=expired.day and provider=expired.provider and client_id=expired.client_id;
  update public.usage_reservations set status='expired' where id=expired.id;
 end loop;
 select coalesce(sum(u.calls),0),coalesce(sum(u.used_tokens+u.reserved_tokens),0) into calls,tokens from public.usage_daily u where day=current_date and provider=p_provider;
 if p_tokens<=0 or calls>=least(p_call_limit,100) or tokens+p_tokens>least(p_token_limit,100000) then raise exception 'Cota local esgotada' using errcode='P0001'; end if;
 insert into public.usage_daily(day,provider,client_id,calls,reserved_tokens) values(current_date,p_provider,p_client,1,p_tokens)
 on conflict(day,provider,client_id) do update set calls=usage_daily.calls+1,reserved_tokens=usage_daily.reserved_tokens+p_tokens;
 insert into public.usage_reservations(provider,client_id,tokens) values(p_provider,p_client,p_tokens) returning id into reservation;
 return reservation;
end $$;
create function public.settle_usage(p_id uuid,p_used int,p_failed boolean default false) returns void language plpgsql security invoker set search_path='' as $$
declare r public.usage_reservations;
begin
 select * into r from public.usage_reservations where id=p_id for update;
 if not found or r.status<>'reserved' then return; end if;
 update public.usage_daily set reserved_tokens=greatest(0,reserved_tokens-r.tokens),used_tokens=used_tokens+greatest(p_used,0),failures=failures+case when p_failed then 1 else 0 end where day=r.day and provider=r.provider and client_id=r.client_id;
 update public.usage_reservations set status='settled',used_tokens=greatest(p_used,0) where id=p_id;
end $$;

create function public.consume_approval(p_id uuid,p_hash text) returns public.action_approvals language plpgsql security invoker set search_path='' as $$
declare a public.action_approvals;
begin
 if (select paused from public.execution_control where id) then raise exception 'Execução pausada'; end if;
 select * into a from public.action_approvals where id=p_id for update;
 if not found or a.status<>'approved' or a.payload_hash<>p_hash or a.expires_at<=now() or a.consumed_at is not null then raise exception 'Aprovação inválida, alterada, usada ou vencida' using errcode='42501'; end if;
 update public.action_approvals set status='consuming',consumed_at=now() where id=p_id returning * into a;
 return a;
end $$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_work_atomic','claim_work','report_work','heartbeat_work','reserve_usage','settle_usage','consume_approval') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;

insert into public.agents(handle,name,platform,role,active,capabilities) values
 ('caua','Cauã','human','Direção e aprovações',true,'{review,approve}'),
 ('chloe','Chloe','central','Captura, busca e organização',true,'{read,prepare}'),
 ('nox','Nox','chatgpt','Carreira, estudo e segunda revisão',false,'{}'),
 ('vega','Vega','claude','Síntese, planejamento e documentação',false,'{}'),
 ('norte','Norte','grok','Coordenação operacional da Axial',false,'{}'),
 ('rastro','Rastro','grok','Verificação de potenciais clientes',false,'{}'),
 ('atlas','Atlas','grok','Demanda e tendências',false,'{}'),
 ('forja','Forja','grok','Escopo e revisão de entregas',false,'{}'),
 ('lume','Lume','grok','Conteúdo e identidade Axial',false,'{}'),
 ('pulso','Pulso','grok','Distribuição mediante aprovação',false,'{}'),
 ('codex','Codex','codex','Implementação e testes',false,'{}'),
 ('cursor','Cursor','cursor','Desenvolvimento assistido',false,'{}'),
 ('opencode','OpenCode','opencode','Executor opcional',false,'{}'),
 ('prumo','Prumo','grok','Pausado inicialmente',false,'{}'),
 ('campus','Campus','grok','Pausado inicialmente',false,'{}')
 on conflict(handle) do nothing;
alter table public.entries add constraint entries_agent_id_fkey foreign key(agent_id) references public.agents(id);
insert into public.team_threads(title,area_id,visibility) select v.title,a.id,'shared' from (values('Geral','inbox'),('Axial','axial'),('Carreira','carreira'),('Desenvolvimento 3C','ambiente-ia')) v(title,slug) left join public.areas a on a.slug=v.slug;
insert into public.team_threads(title,visibility,owner_id) select 'Pessoal','personal',u.id from auth.users u join public.members m on lower(m.email)=lower(u.email);
insert into public.integration_status(provider,connection_mode,activation_steps) values
 ('grok','native_poll','No Grok Bot, conferir bots/horários existentes; instalar o pacote docs/integrations/grok; criar cliente limitado na Central; executar handshake. Sem disparo externo comprovado: aguarda rotina nativa.'),
 ('claude','native_poll','Adicionar o MCP com token próprio no Claude; rodar handshake; conferir agendamentos Cowork existentes antes de habilitar consulta de fila.'),
 ('chatgpt','native_poll','Conectar MCP/REST compatível com o plano atual; token próprio; executar handshake e verificar suporte a ferramentas na rotina nativa.'),
 ('codex','local_executor','No PC pessoal, configurar CENTRAL_URL e CENTRAL_CLIENT_TOKEN; executar npm run runner:inspect e runner:once. Nenhum serviço persistente é instalado.'),
 ('cursor','assisted','Usar o repositório e pacote de trabalho no Cursor atual; API automática não verificada.'),
 ('opencode','optional','Opcional desativado. Exige modelo sem gasto adicional, servidor em loopback e autenticação; não abrir porta pública.'),
 ('axial','contract','Configurar contrato autenticado de resumo no Painel Axial separado. Nenhum banco ou CRM foi recriado.'),
 ('groq','free_evaluated','Inserir chave gratuita no segredo do host; verificar plano/quota; executar avaliação de 20 casos e só então ativar CHLOE_AI_ENABLED.'),
 ('telegram','webhook','Conferir bot e destinatário existentes; configurar webhook com script do projeto e testar captura sem envio em nome do usuário.'),
 ('gmail','native_connector','Conectar Gmail na plataforma responsável e importar apenas links/metadados de itens importantes; não copiar a caixa inteira.'),
 ('calendar','native_connector','Verificar conector nativo da conta responsável; testar leitura/agenda; nenhuma nova conta é criada.'),
 ('drive','native_connector','Autorizar uma pasta delimitada no conector da plataforma; anexar links privados acessíveis.'),
 ('x','native_grok','Conexão informada pelo usuário no Grok, ainda não testada aqui. Usar somente leitura de salvos e pesquisa; sem DMs.'),
 ('social','approval','Canal e capacidade de publicação não verificados. Preparar peças; publicar somente com conteúdo e destino aprovados.')
 on conflict(provider) do nothing;
insert into public.automation_schedules(schedule_key,title,agent_id,workflow_key,cadence,origin,activation_steps)
 select 'observed-grok-'||a.handle,a.name||' — horário informado, não verificado',a.id,v.workflow,v.cadence,'grok','Conferir rotina existente na conta Grok; preservar horário. Este registro não criou nem ativou rotina externa.'
 from (values('atlas','axial_lead','segunda 08:13'),('rastro','axial_lead','segunda 09:07'),('forja','code_demo','segunda 10:17'),('lume','marketing_package','terça 08:07'),('pulso','marketing_package','quinta 10:07'),('norte','weekly_review','sexta 16:47')) v(handle,workflow,cadence) join public.agents a on a.handle=v.handle on conflict(schedule_key) do nothing;
