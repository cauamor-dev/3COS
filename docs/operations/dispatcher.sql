-- Optional activation AFTER verified preview/production; inspect only by default.
-- app_url and cron_secret already live in Vault. Never put their values in a cron command.
-- Do not replace the four existing reminder/news jobs.
select jobname,schedule,active from cron.job;

-- Execute only when dispatcher is enabled and a cloud cycle is ready for validation:
-- select cron.schedule('central-work-dispatch','*/5 * * * *',
--   $job$select central.chamar_app('/api/cron/dispatch')
--   where exists(select 1 from public.execution_control where id and not paused)
--     and exists(select 1 from public.work_items where status in ('queued','running') and available_at<=now())$job$);
-- Observe HTTP outcomes in net._http_response and work_runs; a net enqueue ID is not successful execution.
-- To pause acquisition/effects: Equipe → Pausar tudo, or update execution_control set paused=true where id.
