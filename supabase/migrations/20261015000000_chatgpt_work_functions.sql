-- SQL interface for clients that reach the database through the official
-- Supabase plugin (ChatGPT Work), which cannot use our MCP server or REST API.
-- It mirrors the contract of lib/central/service.ts; keep both in sync.

create extension if not exists unaccent with schema extensions;

create schema if not exists central;
revoke all on schema central from public, anon, authenticated;

-- Safety net: anything deleted from areas/entries is kept here.
create table public.trash (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  row_data jsonb not null,
  deleted_at timestamptz not null default now()
);

alter table public.trash enable row level security;

create policy "members read trash" on public.trash
  for select to authenticated
  using (public.is_member());

create function public.keep_deleted_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trash (source_table, row_data) values (tg_table_name, to_jsonb(old) - 'search');
  return old;
end;
$$;

create trigger areas_keep_deleted
  before delete on public.areas
  for each row execute function public.keep_deleted_row();

create trigger entries_keep_deleted
  before delete on public.entries
  for each row execute function public.keep_deleted_row();

-- Helpers

create function central.slugify(value text)
returns text
language sql
stable
set search_path = ''
as $$
  select trim(both '-' from left(
    trim(both '-' from regexp_replace(lower(extensions.unaccent(coalesce(value, ''))), '[^a-z0-9]+', '-', 'g')),
    60
  ));
$$;

create function central.registro_json(e public.entries, area_slug text, max_chars int)
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
    'criado_em', e.created_at
  ));
$$;

create function central.area_json(a public.areas, max_chars int)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'slug', a.slug,
    'nome', a.name,
    'tipo', a.kind,
    'status', a.status,
    'resumo', case when length(a.summary_md) > max_chars then left(a.summary_md, max_chars) || '…' else a.summary_md end,
    'resumo_truncado', case when length(a.summary_md) > max_chars then true end,
    'atualizado_em', a.updated_at,
    'atualizado_por', a.updated_by
  ));
$$;

create function central.exigir_area(p_area text)
returns public.areas
language plpgsql
stable
set search_path = ''
as $$
declare
  found_area public.areas;
begin
  select * into found_area from public.areas where slug = central.slugify(p_area);
  if not found then
    raise exception 'Área "%" não encontrada. Use central.listar_areas() para ver os slugs.', p_area;
  end if;
  return found_area;
end;
$$;

create function central.garantir_area(
  p_area text,
  p_nome text,
  p_tipo text,
  p_fonte text,
  out area public.areas,
  out criada boolean
)
language plpgsql
set search_path = ''
as $$
declare
  v_slug text := central.slugify(p_area);
begin
  if v_slug = '' then
    raise exception 'Slug de área inválido.';
  end if;
  select * into area from public.areas where slug = v_slug;
  if found then
    criada := false;
    return;
  end if;
  insert into public.areas (slug, name, kind, status, summary_md, updated_by)
  values (
    v_slug,
    coalesce(nullif(trim(p_nome), ''), initcap(replace(v_slug, '-', ' '))),
    coalesce(p_tipo, 'projeto'),
    'ativo',
    '',
    p_fonte
  )
  returning * into area;
  criada := true;
end;
$$;

create function central.normalizar_tags(tags text[])
returns text[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(tag order by first_position), '{}')
  from (
    select central.slugify(raw) as tag, min(position) as first_position
    from unnest(coalesce(tags, '{}')) with ordinality as t(raw, position)
    group by central.slugify(raw)
  ) normalized
  where tag <> '';
$$;

-- Reads

create function central.briefing(p_desde timestamptz default null, p_limite int default 10)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with params as (
    select coalesce(p_desde, now() - interval '7 days') as since, least(greatest(coalesce(p_limite, 10), 1), 30) as lim
  )
  select jsonb_build_object(
    'perfil', coalesce((select left(summary_md, 3000) from public.areas where slug = 'perfil'), ''),
    'preferencias', coalesce((select left(summary_md, 3000) from public.areas where slug = 'preferencias'), ''),
    'areas_ativas', coalesce((
      select jsonb_agg(central.area_json(a, 280) order by a.updated_at desc)
      from public.areas a
      where a.status = 'ativo' and a.kind <> 'perfil' and a.slug <> 'inbox'
    ), '[]'::jsonb),
    'registros_recentes', jsonb_build_object(
      'desde', (select since from params),
      'total', (select count(*) from public.entries e, params where e.created_at >= params.since and not e.archived),
      'itens', coalesce((
        select jsonb_agg(item.json order by item.created_at desc)
        from (
          select central.registro_json(e, a.slug, 240) as json, e.created_at
          from public.entries e
          join public.areas a on a.id = e.area_id, params
          where e.created_at >= params.since and not e.archived
          order by e.created_at desc
          limit (select lim from params)
        ) item
      ), '[]'::jsonb)
    ),
    'inbox_pendentes', (
      select count(*) from public.entries e join public.areas a on a.id = e.area_id
      where a.slug = 'inbox' and not e.archived
    ),
    'dica', 'Use central.ler_area(''slug'') para o resumo completo. Registros com truncado=true: central.ler_registro(''id'').'
  );
$$;

create function central.listar_areas(
  p_status text default null,
  p_tipo text default null,
  p_limite int default 30,
  p_offset int default 0
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with filtered as (
    select * from public.areas
    where (p_status is null or status = p_status) and (p_tipo is null or kind = p_tipo)
  )
  select jsonb_build_object(
    'areas', coalesce((
      select jsonb_agg(central.area_json(page, 280) order by page.updated_at desc)
      from (
        select * from filtered order by updated_at desc
        limit least(greatest(coalesce(p_limite, 30), 1), 100) offset greatest(coalesce(p_offset, 0), 0)
      ) page
    ), '[]'::jsonb),
    'total', (select count(*) from filtered)
  );
$$;

create function central.ler_area(p_slug text, p_limite int default 10, p_incluir_arquivados boolean default false)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  a public.areas := central.exigir_area(p_slug);
begin
  return jsonb_build_object(
    'area', central.area_json(a, 12000),
    'registros', coalesce((
      select jsonb_agg(central.registro_json(page, a.slug, 600) order by page.pinned desc, page.created_at desc)
      from (
        select * from public.entries
        where area_id = a.id and (p_incluir_arquivados or not archived)
        order by created_at desc
        limit least(greatest(coalesce(p_limite, 10), 1), 50)
      ) page
    ), '[]'::jsonb),
    'total_registros', (
      select count(*) from public.entries where area_id = a.id and (p_incluir_arquivados or not archived)
    )
  );
end;
$$;

create function central.ler_registro(p_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  result jsonb;
begin
  select central.registro_json(e, a.slug, 20000) into result
  from public.entries e join public.areas a on a.id = e.area_id
  where e.id = p_id;
  if result is null then
    raise exception 'Registro % não encontrado.', p_id;
  end if;
  return jsonb_build_object('registro', result);
end;
$$;

create function central.buscar(
  p_consulta text,
  p_area text default null,
  p_tipo text default null,
  p_desde timestamptz default null,
  p_ate timestamptz default null,
  p_limite int default 10,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  area_id uuid := case when p_area is null then null else (central.exigir_area(p_area)).id end;
  result jsonb;
begin
  select jsonb_build_object(
    'resultados', coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', r.id,
      'area', r.area_slug,
      'tipo', r.type,
      'titulo', r.title,
      'conteudo', case when length(r.content_md) > 600 then left(r.content_md, 600) || '…' else r.content_md end,
      'truncado', case when length(r.content_md) > 600 then true end,
      'fonte', r.source,
      'criado_em', r.created_at
    )) order by r.rank desc, r.created_at desc), '[]'::jsonb),
    'total', coalesce(max(r.total_count), 0)
  )
  into result
  from public.search_entries(p_consulta, area_id, p_tipo, p_desde, p_ate, false, p_limite, p_offset) r;
  return result;
end;
$$;

-- Writes (every write records its source and versions replaced content)

create function central.salvar_registro(
  p_titulo text,
  p_conteudo text default '',
  p_area text default 'inbox',
  p_tipo text default 'nota',
  p_tags text[] default '{}',
  p_area_nome text default null,
  p_area_tipo text default null,
  p_fixado boolean default false,
  p_fonte text default 'chatgpt'
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

  select * into ensured from central.garantir_area(p_area, p_area_nome, p_area_tipo, p_fonte);

  insert into public.entries (area_id, type, title, content_md, tags, source, updated_by, pinned)
  values (
    (ensured.area).id,
    coalesce(p_tipo, 'nota'),
    left(trim(p_titulo), 200),
    coalesce(p_conteudo, ''),
    central.normalizar_tags(p_tags),
    p_fonte,
    p_fonte,
    coalesce(p_fixado, false)
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

create function central.atualizar_resumo(
  p_area text,
  p_resumo text,
  p_status text default null,
  p_area_nome text default null,
  p_area_tipo text default null,
  p_fonte text default 'chatgpt'
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  ensured record;
  target public.areas;
begin
  select * into ensured from central.garantir_area(p_area, p_area_nome, p_area_tipo, p_fonte);
  target := ensured.area;

  if not ensured.criada and btrim(target.summary_md) <> '' and target.summary_md <> coalesce(p_resumo, '') then
    insert into public.versions (target_table, target_id, previous_title, previous_content, source)
    values ('areas', target.id, null, target.summary_md, p_fonte);
  end if;

  update public.areas
  set summary_md = coalesce(p_resumo, ''), updated_by = p_fonte, status = coalesce(p_status, status)
  where id = target.id
  returning * into target;

  return jsonb_build_object(
    'area', central.area_json(target, 280),
    'area_criada', ensured.criada,
    'mensagem', 'Resumo atualizado. A versão anterior ficou no histórico.'
  );
end;
$$;

create function central.editar_registro(
  p_id uuid,
  p_titulo text default null,
  p_conteudo text default null,
  p_tipo text default null,
  p_tags text[] default null,
  p_fixado boolean default null,
  p_arquivado boolean default null,
  p_area text default null,
  p_fonte text default 'chatgpt'
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
    updated_by = p_fonte
  where id = p_id
  returning * into current_entry;

  select slug into area_slug from public.areas where id = current_entry.area_id;
  return jsonb_build_object('registro', central.registro_json(current_entry, area_slug, 600), 'mensagem', 'Registro atualizado.');
end;
$$;

revoke all on all functions in schema central from public, anon, authenticated;
revoke execute on function public.keep_deleted_row() from public, anon, authenticated;
