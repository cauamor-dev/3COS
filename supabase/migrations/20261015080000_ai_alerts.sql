-- Alerts from the AIs: when Vega (claude) or Nox (chatgpt) save something urgent
-- (priority alta or tag "alerta"), schedule it for the next reminder run, so the
-- existing pg_cron job (every 5 min) sends it by push, Telegram and e-mail.
-- A trigger covers every path at once: MCP, REST API and the SQL functions.

create function central.agendar_alerta_ia()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source in ('claude', 'chatgpt')
     and new.remind_at is null
     and (new.priority = 'alta' or 'alerta' = any(new.tags)) then
    new.remind_at := now();
  end if;
  return new;
end;
$$;

revoke all on function central.agendar_alerta_ia() from public, anon, authenticated;

create trigger entries_alerta_ia
  before insert on public.entries
  for each row execute function central.agendar_alerta_ia();
