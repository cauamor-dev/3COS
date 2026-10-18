-- Reserve aggregate capacity before issuing upload credentials. The cap is local, not an official balance.
create function public.reserve_artifact(p_owner uuid,p_entry uuid,p_area uuid,p_name text,p_mime text,p_size bigint,p_path text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid; allocated bigint;
begin
 perform pg_advisory_xact_lock(3366002);
 select coalesce(sum(size_bytes),0) into allocated from public.artifacts where status='ready' or (status='reserved' and reservation_expires_at>now());
 if p_size<=0 or p_size>(case when p_mime='video/mp4' then 52428800 else 10485760 end) or allocated+p_size>314572800 then raise exception 'Sem reserva de armazenamento'; end if;
 insert into public.artifacts(owner_id,entry_id,area_id,name,mime,size_bytes,object_path,visibility,reservation_expires_at)
 values(p_owner,p_entry,p_area,p_name,p_mime,p_size,p_path,case when p_entry is null then 'private' else 'shared' end,now()+interval '2 hours') returning id into result;
 return result;
end $$;
revoke all on function public.reserve_artifact(uuid,uuid,uuid,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.reserve_artifact(uuid,uuid,uuid,text,text,bigint,text) to service_role;

-- Host infrastructure may impose a stricter limit; callers still enforce the document limit.
update storage.buckets set file_size_limit=52428800,allowed_mime_types=array_append(allowed_mime_types,'video/mp4')
where id='arquivos' and not ('video/mp4'=any(allowed_mime_types));

create table public.career_opportunities (
 entry_id uuid primary key references public.entries(id), owner_id uuid not null references auth.users(id), provider text not null,
 external_id text not null, company text not null, role text not null, canonical_url text not null, location text not null,
 modality text not null, verified_at timestamptz, requirements text not null, fit_explanation text not null,
 next_action text not null, status text not null default 'review', unique(owner_id,provider,external_id)
);
alter table public.career_opportunities enable row level security;
grant select,insert,update on public.career_opportunities to authenticated,service_role;
create policy "own career" on public.career_opportunities for all to authenticated
using(public.is_member() and owner_id=(select auth.uid())) with check(public.is_member() and owner_id=(select auth.uid()));

create table public.chloe_conversations (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.chloe_messages (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.chloe_conversations(id),
 role text not null check(role in ('user','assistant')), content text not null check(length(content)<=50000), entry_id uuid references public.entries(id),
 created_at timestamptz not null default now()
);
create index chloe_messages_conversation on public.chloe_messages(conversation_id,created_at desc);
alter table public.chloe_conversations enable row level security;
alter table public.chloe_messages enable row level security;
grant select,insert on public.chloe_conversations,public.chloe_messages to authenticated,service_role;
create policy "own conversation" on public.chloe_conversations for all to authenticated using(public.is_member() and owner_id=(select auth.uid())) with check(public.is_member() and owner_id=(select auth.uid()));
create policy "own chloe messages" on public.chloe_messages for all to authenticated using(exists(select 1 from public.chloe_conversations c where c.id=conversation_id and c.owner_id=(select auth.uid()) and public.is_member())) with check(exists(select 1 from public.chloe_conversations c where c.id=conversation_id and c.owner_id=(select auth.uid()) and public.is_member()));
