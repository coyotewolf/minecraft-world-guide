alter table public.team_members add column role text not null default 'member' check(role in ('member','admin'));
alter table public.teams add column share_invite boolean not null default false;
update public.team_members m set role='admin' from public.teams t where t.id=m.team_id and t.owner_id=m.user_id;
create table private.team_invite_codes(team_id uuid primary key references public.teams(id) on delete cascade,code text not null,expires_at timestamptz not null);
alter table private.team_invite_codes enable row level security;
revoke all on private.team_invite_codes from public,anon,authenticated;

create function private.can_manage_team(t uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.valid_session() and (private.is_admin() or exists(select 1 from public.team_members where team_id=t and user_id=auth.uid() and role='admin'))
$$;
revoke all on function private.can_manage_team(uuid) from public,anon;
grant execute on function private.can_manage_team(uuid) to authenticated;
create or replace function private.in_team(t uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.valid_session() and (private.is_admin() or exists(select 1 from public.team_members where team_id=t and user_id=auth.uid()))
$$;
create or replace function private.is_owner(t uuid) returns boolean language sql stable security definer set search_path='' as $$select private.can_manage_team(t)$$;

create or replace function private.create_team(n text) returns uuid language plpgsql security definer set search_path='' as $$
declare t uuid;
begin
 if not private.valid_session() then raise exception '請先登入';end if;
 if (select count(*) from public.team_members where user_id=auth.uid())>=20 then raise exception '隊伍數量已達上限';end if;
 insert into public.teams(owner_id,name) values(auth.uid(),trim(n)) returning id into t;
 insert into public.team_members(team_id,user_id,role) values(t,auth.uid(),'admin');return t;
end $$;

create function private.team_invite(t uuid,renew boolean) returns text language plpgsql security definer set search_path='' as $$
declare c text;expiry timestamptz;manager boolean;
begin
 perform 1 from public.teams where id=t for update;
 if not found then raise exception '找不到隊伍';end if;
 manager=private.can_manage_team(t);
 if not manager and not (private.in_team(t) and (select share_invite from public.teams where id=t)) then raise exception '邀請碼未開放給隊員';end if;
 if renew and not manager then raise exception '只有隊伍管理員能更新邀請碼';end if;
 select x.code,x.expires_at into c,expiry from private.team_invite_codes x join private.invites i on i.hash=encode(sha256(convert_to(x.code,'UTF8')),'hex') where x.team_id=t and i.team_id=t and i.remaining>0 and i.expires_at>now();
 if not renew and c is not null then return c;end if;
 if not manager then return null;end if;
 delete from private.invites where team_id=t;
 c=replace(gen_random_uuid()::text,'-','');expiry=now()+interval '7 days';
 insert into private.invites(hash,team_id,expires_at,remaining) values(encode(sha256(convert_to(c,'UTF8')),'hex'),t,expiry,20);
 insert into private.team_invite_codes values(t,c,expiry) on conflict(team_id) do update set code=excluded.code,expires_at=excluded.expires_at;
 return c;
end $$;
create function public.team_invite(t uuid,renew boolean default false) returns text language sql security invoker set search_path='' as $$select private.team_invite(t,renew)$$;
create or replace function private.create_invite(t uuid) returns text language sql security definer set search_path='' as $$select private.team_invite(t,true)$$;

create function private.manage_team(t uuid,action text,uid uuid,value text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.teams where id=t for update;
 if not found or not private.can_manage_team(t) then raise exception '需要隊伍管理員權限';end if;
 if action='share_invite' then
  if value not in ('true','false') then raise exception '無效設定';end if;
  update public.teams set share_invite=value::boolean where id=t;
 elsif action in ('role','remove') then
  if not exists(select 1 from public.team_members where team_id=t and user_id=uid) then raise exception '找不到隊員';end if;
  if action='role' and value not in ('member','admin') then raise exception '無效權限';end if;
  if (action='remove' or value='member') and not private.is_admin() and exists(select 1 from public.team_members where team_id=t and user_id=uid and role='admin') and (select count(*) from public.team_members where team_id=t and role='admin')<=1 then raise exception '請先指定另一位隊伍管理員';end if;
  if action='remove' then delete from public.team_members where team_id=t and user_id=uid;
  else update public.team_members set role=value where team_id=t and user_id=uid;end if;
 else raise exception '無效操作';end if;
 update public.teams set requests_revision=requests_revision+1 where id=t;
end $$;
create function public.manage_team(t uuid,action text,uid uuid default null,value text default null) returns void language sql security invoker set search_path='' as $$select private.manage_team(t,action,uid,value)$$;

create function private.leave_team(t uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.teams where id=t for update;
 if not private.valid_session() or not exists(select 1 from public.team_members where team_id=t and user_id=auth.uid()) then raise exception '你不在這個隊伍';end if;
 if exists(select 1 from public.team_members where team_id=t and user_id=auth.uid() and role='admin') and (select count(*) from public.team_members where team_id=t)>1 and (select count(*) from public.team_members where team_id=t and role='admin')<=1 then raise exception '退出前請先指定另一位隊伍管理員';end if;
 delete from public.team_members where team_id=t and user_id=auth.uid();
 if not exists(select 1 from public.team_members where team_id=t) then delete from private.invites where team_id=t;delete from private.team_invite_codes where team_id=t;end if;
 update public.teams set requests_revision=requests_revision+1 where id=t;
end $$;
create function public.leave_team(t uuid) returns void language sql security invoker set search_path='' as $$select private.leave_team(t)$$;
create or replace function private.join_team(c text) returns uuid language plpgsql security definer set search_path='' as $$
declare inv private.invites;target uuid;invitehash text;
begin
 if not private.valid_session() then raise exception '請先登入';end if;
 invitehash=encode(sha256(convert_to(trim(c),'UTF8')),'hex');
 select team_id into target from private.invites where hash=invitehash;
 perform 1 from public.teams where id=target for update;
 select * into inv from private.invites where hash=invitehash for update;
 if inv.team_id is null or inv.expires_at<now() or inv.remaining<=0 then raise exception '邀請碼無效或已過期';end if;
 if exists(select 1 from public.team_members where team_id=inv.team_id and user_id=auth.uid()) then return inv.team_id;end if;
 if (select count(*) from public.team_members where user_id=auth.uid())>=20 then raise exception '隊伍數量已達上限';end if;
 insert into public.team_members(team_id,user_id) values(inv.team_id,auth.uid());
 update private.invites set remaining=remaining-1 where hash=invitehash;
 update public.teams set requests_revision=requests_revision+1 where id=inv.team_id;return inv.team_id;
end $$;
revoke all on function private.team_invite(uuid,boolean),public.team_invite(uuid,boolean),private.manage_team(uuid,text,uuid,text),public.manage_team(uuid,text,uuid,text),private.leave_team(uuid),public.leave_team(uuid) from public,anon;
grant execute on function private.team_invite(uuid,boolean),public.team_invite(uuid,boolean),private.manage_team(uuid,text,uuid,text),public.manage_team(uuid,text,uuid,text),private.leave_team(uuid),public.leave_team(uuid) to authenticated;
