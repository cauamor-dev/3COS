-- Reminders: devices that receive Web Push, and pg_cron calling the app.
-- The app URL and CRON_SECRET live in Vault (see docs/setup.md), never in migrations.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "members manage push subscriptions" on public.push_subscriptions
  for all to authenticated
  using (public.is_member())
  with check (public.is_member());

revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated, service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net;

create function central.chamar_app(p_path text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    raise warning 'Vault sem app_url ou cron_secret; lembretes desativados.';
    return null;
  end if;
  return net.http_post(
    url := v_url || p_path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function central.chamar_app(text) from public, anon, authenticated;

-- Every 5 minutes: due reminders. 10:00 UTC = 07:00 in São Paulo: daily summary.
select cron.schedule('central-lembretes', '*/5 * * * *', $$select central.chamar_app('/api/cron/lembretes')$$);
select cron.schedule('central-resumo-diario', '0 10 * * *', $$select central.chamar_app('/api/cron/resumo')$$);
