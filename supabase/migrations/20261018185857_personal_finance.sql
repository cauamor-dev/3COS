create table public.personal_finance_imports (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),file_hash text not null,
 source_alias text not null,status text not null default 'reviewed',row_count integer not null check(row_count between 1 and 5000),created_at timestamptz not null default now(),unique(owner_id,file_hash)
);
create table public.personal_transactions (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),date date not null,
 description text not null check(length(description) between 1 and 300),category text not null default 'A revisar',direction text not null check(direction in ('entrada','saida')),
 amount numeric(14,2) not null check(amount>0),currency text not null default 'BRL' check(currency='BRL'),account_alias text not null,
 import_id uuid references public.personal_finance_imports(id),row_number integer,created_at timestamptz not null default now(),unique(import_id,row_number)
);
create index personal_transactions_owner_date on public.personal_transactions(owner_id,date desc);
alter table public.personal_finance_imports enable row level security;
alter table public.personal_transactions enable row level security;
revoke all on public.personal_finance_imports,public.personal_transactions from anon;
grant select,insert,update on public.personal_finance_imports,public.personal_transactions to authenticated,service_role;
create policy "own imports" on public.personal_finance_imports for all to authenticated using(public.is_member() and owner_id=(select auth.uid())) with check(public.is_member() and owner_id=(select auth.uid()));
create policy "own transactions" on public.personal_transactions for all to authenticated using(public.is_member() and owner_id=(select auth.uid())) with check(public.is_member() and owner_id=(select auth.uid()));
create function public.commit_finance_import(p_owner uuid,p_hash text,p_alias text,p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result uuid; line jsonb; existing integer; idx integer=0;
begin
 if p_owner is distinct from auth.uid() or not public.is_member() then raise exception 'Somente o proprietário autenticado' using errcode='42501'; end if;
 if jsonb_array_length(p_rows) not between 1 and 5000 or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Importação inválida'; end if;
 perform pg_advisory_xact_lock(hashtext(p_owner::text||p_hash));
 select id,row_count into result,existing from public.personal_finance_imports where owner_id=p_owner and file_hash=p_hash;
 if found then return jsonb_build_object('id',result,'rows',existing,'duplicate',true); end if;
 insert into public.personal_finance_imports(owner_id,file_hash,source_alias,row_count) values(p_owner,p_hash,p_alias,jsonb_array_length(p_rows)) returning id into result;
 for line in select * from jsonb_array_elements(p_rows) loop
  idx=idx+1;
  insert into public.personal_transactions(owner_id,date,description,category,direction,amount,account_alias,import_id,row_number)
  values(p_owner,(line->>'date')::date,line->>'description',line->>'category',line->>'direction',(line->>'amount')::numeric,p_alias,result,idx);
 end loop;
 return jsonb_build_object('id',result,'rows',idx,'duplicate',false);
end $$;
revoke all on function public.commit_finance_import(uuid,text,text,jsonb) from public,anon,service_role;
grant execute on function public.commit_finance_import(uuid,text,text,jsonb) to authenticated;
