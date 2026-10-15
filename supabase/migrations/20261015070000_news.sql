-- News radar: RSS/Atom sources grouped by topic, collected items and user settings.
-- News live apart from entries so AI briefings and search stay about the user's own work.

create table public.news_feeds (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  name text not null,
  topic text not null,
  language text not null default 'pt',
  enabled boolean not null default true,
  last_fetched_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references public.news_feeds (id) on delete cascade,
  guid text not null,
  title text not null,
  summary text not null default '',
  url text not null,
  image_url text,
  published_at timestamptz not null,
  topic text not null,
  read_at timestamptz,
  saved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (feed_id, guid)
);

create index news_items_published_idx on public.news_items (published_at desc);
create index news_items_topic_idx on public.news_items (topic, published_at desc);

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.news_feeds enable row level security;
alter table public.news_items enable row level security;
alter table public.settings enable row level security;

create policy "members manage news feeds" on public.news_feeds
  for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "members manage news items" on public.news_items
  for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "members manage settings" on public.settings
  for all to authenticated using (public.is_member()) with check (public.is_member());

revoke all on public.news_feeds, public.news_items, public.settings from anon;
grant select, insert, update, delete on public.news_feeds, public.news_items, public.settings to authenticated, service_role;

insert into public.news_feeds (url, name, topic, language) values
  ('https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', 'The Verge · IA', 'IA', 'en'),
  ('https://techcrunch.com/category/artificial-intelligence/feed/', 'TechCrunch · IA', 'IA', 'en'),
  ('https://openai.com/news/rss.xml', 'OpenAI News', 'IA', 'en'),
  ('https://simonwillison.net/atom/everything/', 'Simon Willison', 'IA', 'en'),
  ('https://www.tabnews.com.br/recentes/rss', 'TabNews', 'Dev', 'pt'),
  ('https://dev.to/feed', 'DEV Community', 'Dev', 'en'),
  ('https://github.blog/feed/', 'GitHub Blog', 'Dev', 'en'),
  ('https://nextjs.org/feed.xml', 'Next.js', 'Dev', 'en'),
  ('https://react.dev/rss.xml', 'React', 'Dev', 'en'),
  ('https://blog.angular.dev/feed', 'Angular', 'Dev', 'en'),
  ('https://devblogs.microsoft.com/dotnet/feed/', '.NET Blog', 'Dev', 'en'),
  ('https://hnrss.org/frontpage', 'Hacker News', 'Dev', 'en'),
  ('https://tecnoblog.net/feed/', 'Tecnoblog', 'Tecnologia BR', 'pt'),
  ('https://canaltech.com.br/rss/', 'Canaltech', 'Tecnologia BR', 'pt'),
  ('https://g1.globo.com/rss/g1/tecnologia/', 'g1 Tecnologia', 'Tecnologia BR', 'pt'),
  ('https://olhardigital.com.br/feed/', 'Olhar Digital', 'Tecnologia BR', 'pt'),
  ('https://startups.com.br/feed/', 'Startups', 'Startups e negócios', 'pt'),
  ('https://www.infomoney.com.br/feed/', 'InfoMoney', 'Startups e negócios', 'pt')
on conflict (url) do nothing;

insert into public.settings (key, value) values
  ('news', '{"keywords": ["Next.js", ".NET", "Angular", "React", "IA", "Claude", "ChatGPT", "vagas", "startup", "Supabase"], "mutedTopics": []}')
on conflict (key) do nothing;

-- Collect every 30 minutes; keep 30 days of unsaved items.
select cron.schedule('central-noticias', '*/30 * * * *', $$select central.chamar_app('/api/cron/noticias')$$);
select cron.schedule(
  'central-noticias-limpeza',
  '30 6 * * *',
  $$delete from public.news_items where not saved and published_at < now() - interval '30 days'$$
);
