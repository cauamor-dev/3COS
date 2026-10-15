-- search_entries now returns the agenda/post columns too.

drop function public.search_entries(text, uuid, text, timestamptz, timestamptz, boolean, int, int);

create function public.search_entries(
  q text,
  p_area_id uuid default null,
  p_type text default null,
  p_since timestamptz default null,
  p_until timestamptz default null,
  p_include_archived boolean default false,
  p_limit int default 10,
  p_offset int default 0
)
returns table (
  id uuid,
  area_id uuid,
  area_slug text,
  area_name text,
  type text,
  title text,
  content_md text,
  tags text[],
  source text,
  updated_by text,
  pinned boolean,
  archived boolean,
  created_at timestamptz,
  updated_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean,
  location text,
  recurrence text,
  due_at timestamptz,
  done_at timestamptz,
  remind_at timestamptz,
  reminded_at timestamptz,
  links jsonb,
  image_url text,
  rank real,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with query as (
    select websearch_to_tsquery('portuguese', q) as tsq
  )
  select
    e.id, e.area_id, a.slug, a.name, e.type, e.title, e.content_md, e.tags,
    e.source, e.updated_by, e.pinned, e.archived, e.created_at, e.updated_at,
    e.starts_at, e.ends_at, e.all_day, e.location, e.recurrence, e.due_at, e.done_at,
    e.remind_at, e.reminded_at, e.links, e.image_url,
    ts_rank(e.search, query.tsq) as rank,
    count(*) over () as total_count
  from public.entries e
  join public.areas a on a.id = e.area_id
  cross join query
  where e.search @@ query.tsq
    and (p_area_id is null or e.area_id = p_area_id)
    and (p_type is null or e.type = p_type)
    and (p_since is null or e.created_at >= p_since)
    and (p_until is null or e.created_at <= p_until)
    and (p_include_archived or not e.archived)
  order by rank desc, e.created_at desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

revoke execute on function public.search_entries(text, uuid, text, timestamptz, timestamptz, boolean, int, int) from public, anon;
grant execute on function public.search_entries(text, uuid, text, timestamptz, timestamptz, boolean, int, int)
  to authenticated, service_role;
