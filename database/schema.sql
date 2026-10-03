create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table private.accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 game_key text unique not null,
 recovery_hash text not null,
 recovering_at timestamptz,
 created_at timestamptz not null default now()
);
create table private.rate_limits (key text primary key, count int not null, reset_at timestamptz not null);
alter table private.accounts enable row level security;
alter table private.rate_limits enable row level security;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 game_id text not null check(length(game_id) between 3 and 32),
 created_at timestamptz not null default now()
);
create table public.teams (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id),
 name text not null check(length(name) between 1 and 80),
 created_at timestamptz not null default now()
);
create table public.team_members (
 team_id uuid not null references public.teams(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 joined_at timestamptz not null default now(),
 primary key(team_id,user_id)
);
create index team_members_user on public.team_members(user_id);
create table private.invites (
 hash text primary key, team_id uuid not null references public.teams(id) on delete cascade,
 expires_at timestamptz not null, remaining int not null check(remaining>=0)
);
alter table private.invites enable row level security;
create table public.worlds (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check(length(name) between 1 and 80),
 created_at timestamptz not null default now()
);
create index worlds_user on public.worlds(user_id);
create table public.progress (
 user_id uuid not null references public.profiles(id) on delete cascade,
 world_id uuid not null references public.worlds(id) on delete cascade,
 record_key text not null check(length(record_key) between 1 and 240),
 completed boolean not null default false,
 notes text not null default '' check(length(notes)<=8000),
 checklist jsonb not null default '{}' check(octet_length(checklist::text)<=200000),
 updated_at timestamptz not null default now(),
 primary key(user_id,world_id,record_key)
);
create index progress_world on public.progress(world_id);
create table public.team_records (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.teams(id) on delete cascade,
 author_id uuid not null references public.profiles(id),
 title text not null check(length(title) between 1 and 160),
 kind text not null check(kind in ('base','plan','milestone')),
 body text not null default '' check(length(body)<=8000),
 updated_at timestamptz not null default now()
);
create index team_records_team on public.team_records(team_id);
create table public.requests (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.teams(id) on delete cascade,
 author_id uuid not null references public.profiles(id),
 title text not null check(length(title) between 1 and 160),
 kind text not null check(kind in ('item','mission')),
 body text not null default '' check(length(body)<=4000),
 quantity int check(quantity between 1 and 1000000),
 location text not null default '' check(length(location)<=200),
 scheduled_at timestamptz,
 status text not null default 'open' check(status in ('open','claimed','submitted','completed','cancelled')),
 assignee_id uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index requests_team on public.requests(team_id,created_at desc);
create index requests_author on public.requests(author_id);
create index requests_assignee on public.requests(assignee_id);
create table public.request_comments (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.requests(id) on delete cascade,
 author_id uuid not null references public.profiles(id),
 body text not null check(length(body) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index comments_request on public.request_comments(request_id,created_at);

-- JWTs are not sufficient after recovery: every policy also checks the live session.
create function private.valid_session() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.sessions s where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid())
$$;
create function private.in_team(t uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.valid_session() and exists(select 1 from public.team_members m where m.team_id=t and m.user_id=auth.uid())
$$;
create function private.is_owner(t uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.valid_session() and exists(select 1 from public.teams x where x.id=t and x.owner_id=auth.uid())
$$;
revoke all on function private.valid_session(),private.in_team(uuid),private.is_owner(uuid) from public;
grant execute on function private.valid_session(),private.in_team(uuid),private.is_owner(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.worlds enable row level security;
alter table public.progress enable row level security;
alter table public.team_records enable row level security;
alter table public.requests enable row level security;
alter table public.request_comments enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(private.valid_session() and (id=auth.uid() or exists(select 1 from public.team_members m where m.user_id=profiles.id and private.in_team(m.team_id))));
create policy teams_read on public.teams for select to authenticated using(private.in_team(id));
create policy members_read on public.team_members for select to authenticated using(private.in_team(team_id));
create policy worlds_self on public.worlds for all to authenticated using(private.valid_session() and user_id=auth.uid()) with check(private.valid_session() and user_id=auth.uid());
create policy progress_self on public.progress for all to authenticated using(private.valid_session() and user_id=auth.uid()) with check(private.valid_session() and user_id=auth.uid() and exists(select 1 from public.worlds w where w.id=world_id and w.user_id=auth.uid()));
create policy records_read on public.team_records for select to authenticated using(private.in_team(team_id));
create policy records_insert on public.team_records for insert to authenticated with check(private.in_team(team_id) and author_id=auth.uid());
create policy records_edit on public.team_records for update to authenticated using(private.in_team(team_id) and (author_id=auth.uid() or private.is_owner(team_id))) with check(private.in_team(team_id) and (author_id=auth.uid() or private.is_owner(team_id)));
create policy requests_read on public.requests for select to authenticated using(private.in_team(team_id));
create policy requests_insert on public.requests for insert to authenticated with check(private.in_team(team_id) and author_id=auth.uid() and status='open' and assignee_id is null);
create policy comments_read on public.request_comments for select to authenticated using(exists(select 1 from public.requests r where r.id=request_id and private.in_team(r.team_id)));
create policy comments_insert on public.request_comments for insert to authenticated with check(private.valid_session() and author_id=auth.uid() and exists(select 1 from public.requests r where r.id=request_id and private.in_team(r.team_id)));
revoke all on public.profiles,public.teams,public.team_members,public.worlds,public.progress,public.team_records,public.requests,public.request_comments from anon;
grant select on public.profiles,public.teams,public.team_members,public.requests,public.request_comments,public.team_records to authenticated;
grant select,insert,update,delete on public.worlds,public.progress to authenticated;
grant insert on public.requests,public.request_comments,public.team_records to authenticated;
grant update(title,body,updated_at) on public.team_records to authenticated;

-- Operations needing atomic writes live in the private schema, with guarded invoker wrappers.
create function private.create_team(n text) returns uuid language plpgsql security definer set search_path='' as $$
 declare t uuid;
 begin
 if not private.valid_session() then raise exception '請先登入'; end if;
 if (select count(*) from public.team_members where user_id=auth.uid())>=20 then raise exception '隊伍數量已達上限'; end if;
 insert into public.teams(owner_id,name) values(auth.uid(),n) returning id into t;
 insert into public.team_members(team_id,user_id) values(t,auth.uid()); return t;
 end $$;
create function public.create_team(n text) returns uuid language sql security invoker set search_path='' as $$select private.create_team(n)$$;
create function private.create_invite(t uuid) returns text language plpgsql security definer set search_path='' as $$
 declare c text;
 begin
 if not private.is_owner(t) then raise exception '只有隊長能產生邀請碼'; end if;
 c=replace(gen_random_uuid()::text,'-','');
 insert into private.invites(hash,team_id,expires_at,remaining) values(encode(sha256(convert_to(c,'UTF8')),'hex'),t,now()+interval '7 days',20); return c;
 end $$;
create function public.create_invite(t uuid) returns text language sql security invoker set search_path='' as $$select private.create_invite(t)$$;
create function private.join_team(c text) returns uuid language plpgsql security definer set search_path='' as $$
 declare inv private.invites;
 begin
 if not private.valid_session() then raise exception '請先登入'; end if;
 select * into inv from private.invites where hash=encode(sha256(convert_to(trim(c),'UTF8')),'hex') for update;
 if inv.team_id is null or inv.expires_at<now() or inv.remaining<=0 then raise exception '邀請碼無效或已過期'; end if;
 if exists(select 1 from public.team_members where team_id=inv.team_id and user_id=auth.uid()) then return inv.team_id; end if;
 if (select count(*) from public.team_members where user_id=auth.uid())>=20 then raise exception '隊伍數量已達上限'; end if;
 insert into public.team_members(team_id,user_id) values(inv.team_id,auth.uid());
 update private.invites set remaining=remaining-1 where hash=inv.hash; return inv.team_id;
 end $$;
create function public.join_team(c text) returns uuid language sql security invoker set search_path='' as $$select private.join_team(c)$$;
create function private.request_action(rid uuid,action text) returns void language plpgsql security definer set search_path='' as $$
 declare r public.requests;
 begin
 select * into r from public.requests where id=rid for update;
 if r.id is null or not private.in_team(r.team_id) then raise exception '找不到申請'; end if;
 if action='claim' and r.status='open' and r.author_id<>auth.uid() then
 update public.requests set status='claimed',assignee_id=auth.uid(),updated_at=now() where id=rid;
 elsif action='release' and r.status='claimed' and r.assignee_id=auth.uid() then
 update public.requests set status='open',assignee_id=null,updated_at=now() where id=rid;
 elsif action='submit' and r.status='claimed' and r.assignee_id=auth.uid() then
 update public.requests set status='submitted',updated_at=now() where id=rid;
 elsif action='complete' and r.status='submitted' and r.author_id=auth.uid() then
 update public.requests set status='completed',updated_at=now() where id=rid;
 elsif action='cancel' and r.status in ('open','claimed','submitted') and r.author_id=auth.uid() then
 update public.requests set status='cancelled',updated_at=now() where id=rid;
 elsif action='reopen' and r.status='submitted' and r.author_id=auth.uid() then
 update public.requests set status='claimed',updated_at=now() where id=rid;
 else raise exception '申請狀態已改變，或你沒有操作權限'; end if;
 end $$;
create function public.request_action(rid uuid,action text) returns void language sql security invoker set search_path='' as $$select private.request_action(rid,action)$$;
revoke all on function private.create_team(text),public.create_team(text),private.create_invite(uuid),public.create_invite(uuid),private.join_team(text),public.join_team(text),private.request_action(uuid,text),public.request_action(uuid,text) from public;
grant execute on function private.create_team(text),public.create_team(text),private.create_invite(uuid),public.create_invite(uuid),private.join_team(text),public.join_team(text),private.request_action(uuid,text),public.request_action(uuid,text) to authenticated;

-- Service-only registration, rate limiting and recovery. No plaintext credentials are stored.
create function public.account_store(uid uuid,gkey text,rhash text) returns void language sql security invoker set search_path='' as $$insert into private.accounts(user_id,game_key,recovery_hash) values(uid,gkey,rhash)$$;
create function public.account_lookup(gkey text) returns table(user_id uuid,recovery_hash text,recovering_at timestamptz) language sql security invoker set search_path='' as $$select a.user_id,a.recovery_hash,a.recovering_at from private.accounts a where a.game_key=gkey$$;
create function public.recovery_lock(uid uuid,rhash text) returns boolean language plpgsql security invoker set search_path='' as $$
 begin update private.accounts set recovering_at=now() where user_id=uid and recovery_hash=rhash and (recovering_at is null or recovering_at<now()-interval '2 minutes');return found;end $$;
create function public.recovery_finish(uid uuid,rhash text) returns void language sql security invoker set search_path='' as $$update private.accounts set recovery_hash=rhash,recovering_at=null where user_id=uid$$;
create function public.rate_limit(k text,lim int,seconds int) returns boolean language plpgsql security invoker set search_path='' as $$
 declare n int;
 begin
 insert into private.rate_limits(key,count,reset_at) values(k,1,now()+make_interval(secs=>seconds))
 on conflict(key) do update set count=case when private.rate_limits.reset_at<now() then 1 else private.rate_limits.count+1 end,reset_at=case when private.rate_limits.reset_at<now() then now()+make_interval(secs=>seconds) else private.rate_limits.reset_at end returning count into n;
 delete from private.rate_limits where reset_at<now()-interval '1 day'; return n<=lim;end $$;
create function public.revoke_player_sessions(uid uuid) returns void language plpgsql security definer set search_path='' as $$
 begin delete from auth.sessions where user_id=uid;end $$;
revoke all on function public.account_store(uuid,text,text),public.account_lookup(text),public.recovery_lock(uuid,text),public.recovery_finish(uuid,text),public.rate_limit(text,int,int),public.revoke_player_sessions(uuid) from public,anon,authenticated;
grant execute on function public.account_store(uuid,text,text),public.account_lookup(text),public.recovery_lock(uuid,text),public.recovery_finish(uuid,text),public.rate_limit(text,int,int),public.revoke_player_sessions(uuid) to service_role;
grant all on private.accounts,private.rate_limits to service_role;
alter publication supabase_realtime add table public.requests,public.request_comments,public.team_records;
