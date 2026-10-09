create table private.assistant_storage_usage (
 user_id uuid primary key references auth.users(id) on delete cascade,
 conversations integer not null default 0 check(conversations>=0),
 messages integer not null default 0 check(messages>=0),
 bytes bigint not null default 0 check(bytes>=0)
);
alter table private.assistant_storage_usage enable row level security;
revoke all on private.assistant_storage_usage from public,anon,authenticated;
insert into private.assistant_storage_usage(user_id,conversations,messages,bytes)
select user_id,sum(conversations),sum(messages),sum(bytes) from (
 select user_id,count(*)::integer conversations,0 messages,sum(octet_length(title))::bigint bytes from public.assistant_conversations group by user_id
 union all select user_id,0,count(*)::integer,sum(octet_length(text)+octet_length(facts::text))::bigint from public.assistant_messages group by user_id
) x group by user_id;
create function private.track_assistant_storage() returns trigger language plpgsql security definer set search_path='' as $fn$
declare uid uuid;dc integer:=0;dm integer:=0;db bigint:=0;
begin
 uid=case when tg_op='DELETE' then old.user_id else new.user_id end;
 if tg_op='DELETE' and not exists(select 1 from auth.users where id=uid) then return old;end if;
 if tg_op='UPDATE' and new.user_id is distinct from old.user_id then raise exception '聊天紀錄不能轉移帳號' using errcode='42501';end if;
 if tg_op<>'DELETE' and auth.role()='authenticated' then
  if not private.valid_session() or uid is distinct from auth.uid() then raise exception '請重新登入' using errcode='42501';end if;
  if tg_op='INSERT' and not public.rate_limit('assistant-write:'||uid::text,120,60) then raise exception '聊天同步稍快，請稍後重試' using errcode='P0001';end if;
 end if;
 if tg_table_name='assistant_conversations' then
  dc=case tg_op when 'INSERT' then 1 when 'DELETE' then -1 else 0 end;
  db=case tg_op when 'INSERT' then octet_length(new.title) when 'DELETE' then -octet_length(old.title) else octet_length(new.title)-octet_length(old.title) end;
 else
  dm=case tg_op when 'INSERT' then 1 when 'DELETE' then -1 else 0 end;
  db=case tg_op when 'INSERT' then octet_length(new.text)+octet_length(new.facts::text) when 'DELETE' then -octet_length(old.text)-octet_length(old.facts::text) else octet_length(new.text)+octet_length(new.facts::text)-octet_length(old.text)-octet_length(old.facts::text) end;
 end if;
 insert into private.assistant_storage_usage(user_id) values(uid) on conflict do nothing;
 update private.assistant_storage_usage set conversations=greatest(0,conversations+dc),messages=greatest(0,messages+dm),bytes=greatest(0,bytes+db)
 where user_id=uid and ((dc<=0 and dm<=0 and db<=0) or (conversations+dc<=100 and messages+dm<=2000 and bytes+db<=20971520));
 if not found then raise exception '聊天儲存已達上限，請先刪除不需要的對話再同步' using errcode='P0001';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $fn$;
revoke all on function private.track_assistant_storage() from public,anon,authenticated,service_role;
create trigger assistant_conversations_storage_write before insert or update on public.assistant_conversations for each row execute function private.track_assistant_storage();
create trigger assistant_conversations_storage_delete after delete on public.assistant_conversations for each row execute function private.track_assistant_storage();
create trigger assistant_messages_storage_write before insert or update on public.assistant_messages for each row execute function private.track_assistant_storage();
create trigger assistant_messages_storage_delete after delete on public.assistant_messages for each row execute function private.track_assistant_storage();
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path='' as $fn$
 select private.valid_session() and coalesce(auth.jwt()->>'aal','aal1')='aal2' and exists(select 1 from private.admins where user_id=auth.uid())
$fn$;
create function private.needs_admin_mfa() returns boolean language sql stable security definer set search_path='' as $fn$
 select private.valid_session() and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' and exists(select 1 from private.admins where user_id=auth.uid())
$fn$;
revoke all on function private.needs_admin_mfa() from public,anon,service_role;
grant execute on function private.needs_admin_mfa() to authenticated;
create or replace function public.player_status() returns jsonb language sql set search_path='' as $fn$
 select jsonb_build_object('admin',private.is_admin(),'active',private.valid_session(),'admin_mfa_required',private.needs_admin_mfa())
$fn$;

