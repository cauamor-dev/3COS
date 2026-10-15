alter table public.entries
  add column priority text check (priority in ('alta', 'media', 'baixa'));

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
    'prioridade', e.priority,
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

-- Priority for the SQL interface: a small setter keeps the long signatures stable.
create function central.definir_prioridade(p_id uuid, p_prioridade text, p_fonte text default 'chatgpt')
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  updated public.entries;
  area_slug text;
begin
  update public.entries set priority = p_prioridade, updated_by = p_fonte where id = p_id returning * into updated;
  if not found then
    raise exception 'Registro % não encontrado.', p_id;
  end if;
  select slug into area_slug from public.areas where id = updated.area_id;
  return jsonb_build_object('registro', central.registro_json(updated, area_slug, 600), 'mensagem', 'Prioridade atualizada.');
end;
$$;

revoke all on all functions in schema central from public, anon, authenticated;
