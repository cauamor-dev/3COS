-- Agenda, tasks and the Mural feed live in entries so search, history,
-- the graph and every AI tool keep working for them.

alter table public.entries drop constraint entries_type_check;
alter table public.entries add constraint entries_type_check
  check (type in ('contexto', 'decisao', 'progresso', 'tarefa', 'nota', 'ideia', 'evento', 'post'));

alter table public.entries
  add column starts_at timestamptz,
  add column ends_at timestamptz,
  add column all_day boolean not null default false,
  add column location text,
  add column recurrence text check (recurrence in ('diaria', 'semanal', 'mensal', 'anual')),
  add column due_at timestamptz,
  add column done_at timestamptz,
  add column remind_at timestamptz,
  add column reminded_at timestamptz,
  add column links jsonb not null default '[]'::jsonb,
  add column image_url text;

alter table public.entries add constraint entries_event_needs_start
  check (type <> 'evento' or starts_at is not null);

create index entries_starts_idx on public.entries (starts_at) where starts_at is not null;
create index entries_due_idx on public.entries (due_at) where due_at is not null and done_at is null;
create index entries_remind_idx on public.entries (remind_at) where remind_at is not null and reminded_at is null;
create index entries_posts_idx on public.entries (created_at desc) where type = 'post';
