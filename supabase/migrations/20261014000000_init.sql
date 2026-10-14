create table public.members (
  email text primary key,
  created_at timestamptz not null default now()
);

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  kind text not null default 'projeto'
    check (kind in ('projeto', 'trabalho', 'faculdade', 'curso', 'pessoal', 'ideia', 'perfil')),
  status text not null default 'ativo'
    check (status in ('ativo', 'pausado', 'concluido', 'arquivado')),
  summary_md text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null default 'manual'
    check (updated_by in ('claude', 'chatgpt', 'manual', 'cursor'))
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas (id) on delete cascade,
  type text not null default 'nota'
    check (type in ('contexto', 'decisao', 'progresso', 'tarefa', 'nota', 'ideia')),
  title text not null check (char_length(title) between 1 and 200),
  content_md text not null default '',
  tags text[] not null default '{}',
  source text not null default 'manual'
    check (source in ('claude', 'chatgpt', 'manual', 'cursor')),
  updated_by text not null default 'manual'
    check (updated_by in ('claude', 'chatgpt', 'manual', 'cursor')),
  pinned boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(content_md, '')), 'B')
  ) stored
);

create index entries_search_idx on public.entries using gin (search);
create index entries_tags_idx on public.entries using gin (tags);
create index entries_area_created_idx on public.entries (area_id, created_at desc);
create index entries_created_idx on public.entries (created_at desc);

create table public.versions (
  id uuid primary key default gen_random_uuid(),
  target_table text not null check (target_table in ('areas', 'entries')),
  target_id uuid not null,
  previous_title text,
  previous_content text not null,
  source text not null check (source in ('claude', 'chatgpt', 'manual', 'cursor')),
  created_at timestamptz not null default now()
);

create index versions_target_idx on public.versions (target_table, target_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger areas_set_updated_at
  before update on public.areas
  for each row execute function public.set_updated_at();

create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

-- Security definer so the policy check can read members without recursing into its own RLS.
create function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members where email = (auth.jwt() ->> 'email')
  );
$$;

revoke execute on function public.is_member() from anon;

alter table public.members enable row level security;
alter table public.areas enable row level security;
alter table public.entries enable row level security;
alter table public.versions enable row level security;

create policy "members read own row" on public.members
  for select to authenticated
  using (email = (auth.jwt() ->> 'email'));

create policy "members manage areas" on public.areas
  for all to authenticated
  using (public.is_member())
  with check (public.is_member());

create policy "members manage entries" on public.entries
  for all to authenticated
  using (public.is_member())
  with check (public.is_member());

create policy "members manage versions" on public.versions
  for all to authenticated
  using (public.is_member())
  with check (public.is_member());

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

alter publication supabase_realtime add table public.entries, public.areas;
