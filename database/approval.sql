alter table private.accounts add column approved boolean not null default false;
create table private.admins(user_id uuid primary key references auth.users(id) on delete cascade);
create table private.bootstrap(hash text primary key, used_at timestamptz);
alter table private.admins enable row level security;
alter table private.bootstrap enable row level security;
grant all on private.admins,private.bootstrap to service_role;
alter table public.profiles add column share_progress boolean not null default true;
create or replace function private.valid_session() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.sessions s join private.accounts a on a.user_id=s.user_id where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid() and a.approved)
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select private.valid_session() and exists(select 1 from private.admins where user_id=auth.uid())$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;
create function public.player_status() returns jsonb language sql security invoker set search_path='' as $$select jsonb_build_object('admin',private.is_admin(),'active',private.valid_session())$$;
revoke all on function public.player_status() from public;
grant execute on function public.player_status() to authenticated;
create policy profiles_preferences on public.profiles for update to authenticated using(private.valid_session() and id=auth.uid()) with check(private.valid_session() and id=auth.uid());
grant update(share_progress) on public.profiles to authenticated;

-- Team comparison exposes completed flags only, never notes or checklist details.
create function private.team_progress(t uuid) returns table(user_id uuid,game_id text,record_key text,completed boolean) language plpgsql security definer set search_path='' as $$
 begin
 if not private.in_team(t) then raise exception '只能查看自己的隊伍'; end if;
 return query select p.id,p.game_id,g.record_key,g.completed from public.team_members m join public.profiles p on p.id=m.user_id left join public.progress g on g.user_id=m.user_id and g.completed=true and g.record_key not like 'guide:%' where m.team_id=t and p.share_progress;
 end $$;
create function public.team_progress(t uuid) returns table(user_id uuid,game_id text,record_key text,completed boolean) language sql security invoker set search_path='' as $$select * from private.team_progress(t)$$;
revoke all on function private.team_progress(uuid),public.team_progress(uuid) from public;
grant execute on function private.team_progress(uuid),public.team_progress(uuid) to authenticated;

create function public.account_status(gkey text) returns boolean language sql security invoker set search_path='' as $$select approved from private.accounts where game_key=gkey$$;
create function public.bootstrap_admin(uid uuid,h text) returns boolean language plpgsql security invoker set search_path='' as $$
 begin
 update private.bootstrap set used_at=now() where hash=h and used_at is null;
 if not found then return false; end if;
 insert into private.admins(user_id) values(uid);update private.accounts set approved=true where user_id=uid;return true;
 end $$;
revoke all on function public.account_status(text),public.bootstrap_admin(uuid,text) from public,anon,authenticated;
grant execute on function public.account_status(text),public.bootstrap_admin(uuid,text) to service_role;

create function private.admin_players() returns table(user_id uuid,game_id text,approved boolean,is_admin boolean,created_at timestamptz) language plpgsql security definer set search_path='' as $$
 begin
 if not private.is_admin() then raise exception '需要管理員權限'; end if;
 return query select p.id,p.game_id,a.approved,exists(select 1 from private.admins x where x.user_id=p.id),p.created_at from private.accounts a join public.profiles p on p.id=a.user_id order by p.created_at desc;
 end $$;
create function public.admin_players() returns table(user_id uuid,game_id text,approved boolean,is_admin boolean,created_at timestamptz) language sql security invoker set search_path='' as $$select * from private.admin_players()$$;
create function private.admin_approve(uid uuid,allow boolean) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not private.is_admin() then raise exception '需要管理員權限'; end if;
 if exists(select 1 from private.admins where user_id=uid) then raise exception '管理員帳號不能停用';end if;
 update private.accounts set approved=allow where user_id=uid;
 if not allow then delete from auth.sessions where user_id=uid;end if;
 end $$;
create function public.admin_approve(uid uuid,allow boolean) returns void language sql security invoker set search_path='' as $$select private.admin_approve(uid,allow)$$;
create function private.admin_make(uid uuid) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not private.is_admin() then raise exception '需要管理員權限';end if;
 if not exists(select 1 from private.accounts where user_id=uid and approved) then raise exception '請先核准帳號';end if;
 insert into private.admins(user_id) values(uid) on conflict do nothing;
 end $$;
create function public.admin_make(uid uuid) returns void language sql security invoker set search_path='' as $$select private.admin_make(uid)$$;
revoke all on function private.admin_players(),public.admin_players(),private.admin_approve(uuid,boolean),public.admin_approve(uuid,boolean),private.admin_make(uuid),public.admin_make(uuid) from public;
grant execute on function private.admin_players(),public.admin_players(),private.admin_approve(uuid,boolean),public.admin_approve(uuid,boolean),private.admin_make(uuid),public.admin_make(uuid) to authenticated;
create function private.revoke_player_sessions(uid uuid) returns void language plpgsql security definer set search_path='' as $$begin delete from auth.sessions where user_id=uid;end $$;
create or replace function public.revoke_player_sessions(uid uuid) returns void language sql security invoker set search_path='' as $$select private.revoke_player_sessions(uid)$$;
revoke all on function private.revoke_player_sessions(uuid) from public,anon,authenticated;
grant execute on function private.revoke_player_sessions(uuid) to service_role;
