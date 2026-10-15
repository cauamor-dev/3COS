-- Agenda, tasks and posts for the SQL interface used by ChatGPT Work.
-- Mirrors the agenda/listTasks contract of lib/central/service.ts.

create or replace function central.registro_json(e public.entries, area_slug text, max_chars int)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', e.id,
    'area', area_slug,
    'tipo', e.type,
    'titulo', e.title,
    'conteudo', case when length(e.content_md) > max_chars then left(e.content_md, max_chars) || '…' else e.content_md end,
    'truncado', case when length(e.content_md) > max_chars then true end,
    'total_caracteres', case when length(e.content_md) > max_chars then length(e.content_md) end,
    'tags', to_jsonb(e.tags),
    'fonte', e.source,
    'fixado', case when e.pinned then true end,
    'arquivado', case when e.archived then true end,
    'criado_em', e.created_at,
    'inicio', e.starts_at,
    'fim', e.ends_at,
    'dia_inteiro', case when e.all_day then true end,
    'local', e.location,
    'recorrencia', e.recurrence,
    'prazo', e.due_at,
    'concluida', case when e.type = 'tarefa' then e.done_at is not null end,
    'concluida_em', e.done_at,
    'lembrar_em', e.remind_at,
    'links', case when jsonb_array_length(e.links) > 0 then e.links end,
    'imagem', e.image_url
  ));
$$;

create function central.data_inicio(value text)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case
    when value is null then null
    when value ~ '^\d{4}-\d{2}-\d{2}$' then (value || 'T00:00:00-03:00')::timestamptz
    else value::timestamptz
  end;
$$;

create function central.data_fim(value text)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case
    when value is null then null
    when value ~ '^\d{4}-\d{2}-\d{2}$' then (value || 'T23:59:59.999-03:00')::timestamptz
    else value::timestamptz
  end;
$$;

drop function central.salvar_registro(text, text, text, text, text[], text, text, boolean, text);

create function central.salvar_registro(
  p_titulo text,
  p_conteudo text default '',
  p_area text default 'inbox',
  p_tipo text default 'nota',
  p_tags text[] default '{}',
  p_area_nome text default null,
  p_area_tipo text default null,
  p_fixado boolean default false,
  p_fonte text default 'chatgpt',
  p_inicio text default null,
  p_fim text default null,
  p_dia_inteiro boolean default null,
  p_local text default null,
  p_recorrencia text default null,
  p_prazo text default null,
  p_lembrar_em text default null,
  p_links jsonb default '[]',
  p_imagem text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  ensured record;
  created_entry public.entries;
begin
  if coalesce(trim(p_titulo), '') = '' then
    raise exception 'Informe um título.';
  end if;
  if p_tipo = 'evento' and p_inicio is null then
    raise exception 'Eventos precisam de p_inicio.';
  end if;

  select * into ensured from central.garantir_area(p_area, p_area_nome, p_area_tipo, p_fonte);

  insert into public.entries (
    area_id, type, title, content_md, tags, source, updated_by, pinned,
    starts_at, ends_at, all_day, location, recurrence, due_at, remind_at, links, image_url
  )
  values (
    (ensured.area).id,
    coalesce(p_tipo, 'nota'),
    left(trim(p_titulo), 200),
    coalesce(p_conteudo, ''),
    central.normalizar_tags(p_tags),
    p_fonte,
    p_fonte,
    coalesce(p_fixado, false),
    central.data_inicio(p_inicio),
    central.data_fim(p_fim),
    coalesce(p_dia_inteiro, p_inicio ~ '^\d{4}-\d{2}-\d{2}$', false),
    p_local,
    p_recorrencia,
    central.data_fim(p_prazo),
    central.data_inicio(p_lembrar_em),
    coalesce(p_links, '[]'),
    p_imagem
  )
  returning * into created_entry;

  update public.areas set updated_at = now(), updated_by = p_fonte where id = (ensured.area).id;

  return jsonb_build_object(
    'registro', central.registro_json(created_entry, (ensured.area).slug, 600),
    'area_criada', ensured.criada,
    'mensagem', case
      when ensured.criada then format('Registro salvo. A área "%s" não existia e foi criada.', (ensured.area).slug)
      else format('Registro salvo em "%s".', (ensured.area).slug)
    end
  );
end;
$$;

drop function central.editar_registro(uuid, text, text, text, text[], boolean, boolean, text, text);

create function central.editar_registro(
  p_id uuid,
  p_titulo text default null,
  p_conteudo text default null,
  p_tipo text default null,
  p_tags text[] default null,
  p_fixado boolean default null,
  p_arquivado boolean default null,
  p_area text default null,
  p_fonte text default 'chatgpt',
  p_concluida boolean default null,
  p_inicio text default null,
  p_fim text default null,
  p_local text default null,
  p_recorrencia text default null,
  p_prazo text default null,
  p_lembrar_em text default null,
  p_links jsonb default null,
  p_imagem text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  current_entry public.entries;
  new_area_id uuid;
  area_slug text;
begin
  select * into current_entry from public.entries where id = p_id;
  if not found then
    raise exception 'Registro % não encontrado.', p_id;
  end if;

  if p_area is not null then
    new_area_id := (central.exigir_area(p_area)).id;
  end if;

  if (p_conteudo is not null and p_conteudo <> current_entry.content_md)
     or (p_titulo is not null and p_titulo <> current_entry.title) then
    insert into public.versions (target_table, target_id, previous_title, previous_content, source)
    values ('entries', current_entry.id, current_entry.title, current_entry.content_md, p_fonte);
  end if;

  update public.entries set
    title = coalesce(left(trim(p_titulo), 200), title),
    content_md = coalesce(p_conteudo, content_md),
    type = coalesce(p_tipo, type),
    tags = case when p_tags is null then tags else central.normalizar_tags(p_tags) end,
    pinned = coalesce(p_fixado, pinned),
    archived = coalesce(p_arquivado, archived),
    area_id = coalesce(new_area_id, area_id),
    done_at = case when p_concluida is null then done_at when p_concluida then now() else null end,
    starts_at = coalesce(central.data_inicio(p_inicio), starts_at),
    ends_at = coalesce(central.data_fim(p_fim), ends_at),
    location = coalesce(p_local, location),
    recurrence = coalesce(p_recorrencia, recurrence),
    due_at = coalesce(central.data_fim(p_prazo), due_at),
    remind_at = coalesce(central.data_inicio(p_lembrar_em), remind_at),
    reminded_at = case when p_lembrar_em is null then reminded_at else null end,
    links = coalesce(p_links, links),
    image_url = coalesce(p_imagem, image_url),
    updated_by = p_fonte
  where id = p_id
  returning * into current_entry;

  select slug into area_slug from public.areas where id = current_entry.area_id;
  return jsonb_build_object('registro', central.registro_json(current_entry, area_slug, 600), 'mensagem', 'Registro atualizado.');
end;
$$;

create function central.proxima_ocorrencia(at timestamptz, rule text)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case rule
    when 'diaria' then at + interval '1 day'
    when 'semanal' then at + interval '7 days'
    when 'mensal' then ((at at time zone 'America/Sao_Paulo') + interval '1 month') at time zone 'America/Sao_Paulo'
    when 'anual' then ((at at time zone 'America/Sao_Paulo') + interval '1 year') at time zone 'America/Sao_Paulo'
  end;
$$;

create function central.ver_agenda(p_de text default null, p_ate text default null, p_area text default null)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_from timestamptz := coalesce(
    central.data_inicio(p_de),
    (date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo'
  );
  v_to timestamptz := coalesce(central.data_fim(p_ate), v_from + interval '8 days');
  v_area uuid := case when p_area is null then null else (central.exigir_area(p_area)).id end;
  result jsonb;
begin
  with recursive occurrences as (
    select e.id, e.starts_at as occ_start, coalesce(e.ends_at - e.starts_at, interval '0') as duration, e.recurrence, 0 as n
    from public.entries e
    where e.type = 'evento' and not e.archived and e.starts_at <= v_to
      and (v_area is null or e.area_id = v_area)
    union all
    select o.id, central.proxima_ocorrencia(o.occ_start, o.recurrence), o.duration, o.recurrence, o.n + 1
    from occurrences o
    where o.recurrence is not null and o.n < 400 and central.proxima_ocorrencia(o.occ_start, o.recurrence) <= v_to
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', v_from, 'ate', v_to),
    'eventos', coalesce((
      select jsonb_agg(
        central.registro_json(e, a.slug, 240)
          || jsonb_build_object('inicio', o.occ_start)
          || case when e.ends_at is null then '{}'::jsonb else jsonb_build_object('fim', o.occ_start + o.duration) end
        order by o.occ_start
      )
      from occurrences o
      join public.entries e on e.id = o.id
      join public.areas a on a.id = e.area_id
      where o.occ_start + o.duration >= v_from
    ), '[]'::jsonb),
    'tarefas_atrasadas', coalesce((
      select jsonb_agg(central.registro_json(e, a.slug, 240) order by e.due_at)
      from public.entries e join public.areas a on a.id = e.area_id
      where e.type = 'tarefa' and not e.archived and e.done_at is null and e.due_at < now()
        and (v_area is null or e.area_id = v_area)
    ), '[]'::jsonb),
    'tarefas_no_periodo', coalesce((
      select jsonb_agg(central.registro_json(e, a.slug, 240) order by e.due_at)
      from public.entries e join public.areas a on a.id = e.area_id
      where e.type = 'tarefa' and not e.archived and e.done_at is null and e.due_at >= now() and e.due_at <= v_to
        and (v_area is null or e.area_id = v_area)
    ), '[]'::jsonb)
  )
  into result;
  return result;
end;
$$;

create function central.listar_tarefas(p_status text default 'pendentes', p_area text default null, p_limite int default 30)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_area uuid := case when p_area is null then null else (central.exigir_area(p_area)).id end;
  result jsonb;
begin
  select jsonb_build_object(
    'tarefas', coalesce(jsonb_agg(central.registro_json(t, t_slug, 600) order by t_order), '[]'::jsonb),
    'total', count(*)
  )
  into result
  from (
    select e as t, a.slug as t_slug,
      case when p_status = 'concluidas' then -extract(epoch from e.done_at) else extract(epoch from coalesce(e.due_at, 'infinity')) end as t_order
    from public.entries e join public.areas a on a.id = e.area_id
    where e.type = 'tarefa' and not e.archived
      and (v_area is null or e.area_id = v_area)
      and (p_status = 'todas' or (p_status = 'pendentes' and e.done_at is null) or (p_status = 'concluidas' and e.done_at is not null))
    order by 3
    limit least(greatest(coalesce(p_limite, 30), 1), 100)
  ) tasks;
  return result;
end;
$$;

revoke all on all functions in schema central from public, anon, authenticated;
