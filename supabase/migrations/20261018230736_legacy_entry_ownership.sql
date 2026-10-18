create function central.entry_default_owner() returns trigger language plpgsql security definer set search_path='' as $$
declare members_count integer; actual_owner uuid;
begin
 if new.owner_id is not null then return new; end if;
 if auth.uid() is not null then new.owner_id=auth.uid();return new;end if;
 select count(*),(array_agg(u.id))[1] into members_count,actual_owner from auth.users u join public.members m on lower(u.email)=lower(m.email);
 if members_count<>1 then raise exception 'Proprietário explícito necessário'; end if;
 new.owner_id=actual_owner;return new;
end $$;
revoke all on function central.entry_default_owner() from public,anon,authenticated;
create trigger entries_default_owner before insert on public.entries for each row execute function central.entry_default_owner();
update public.entries e set owner_id=u.id from auth.users u join public.members m on lower(u.email)=lower(m.email) where e.owner_id is null and (select count(*) from auth.users u2 join public.members m2 on lower(u2.email)=lower(m2.email))=1;
