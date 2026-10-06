create function private.admin_add_team_member(t uuid,uid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.valid_session() or not private.is_admin() then raise exception '需要網站管理員權限';end if;
 perform 1 from public.teams where id=t for update;
 if not found then raise exception '隊伍不存在';end if;
 if not exists(select 1 from private.accounts where user_id=uid and approved) then raise exception '玩家尚未核准';end if;
 insert into public.team_members(team_id,user_id,role) values(t,uid,'member') on conflict do nothing;
 update public.teams set requests_revision=requests_revision+1 where id=t;
end $$;
create function public.admin_add_team_member(t uuid,uid uuid) returns void language sql security invoker set search_path='' as $$select private.admin_add_team_member(t,uid)$$;
revoke all on function public.admin_add_team_member(uuid,uuid),private.admin_add_team_member(uuid,uuid) from public,anon;
grant execute on function public.admin_add_team_member(uuid,uuid),private.admin_add_team_member(uuid,uuid) to authenticated;

create table private.push_config(id boolean primary key default true check(id),config jsonb not null);
create table private.push_devices(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,endpoint text not null unique,subscription jsonb not null,updated_at timestamptz not null default now());
alter table private.push_config enable row level security;
alter table private.push_devices enable row level security;
revoke all on private.push_config,private.push_devices from public,anon,authenticated;
create function public.push_configuration(value jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'Forbidden';end if;
 if value is not null then insert into private.push_config values(true,value) on conflict do nothing;end if;
 return (select config from private.push_config where id);
end $$;
revoke all on function public.push_configuration(jsonb) from public,anon,authenticated;
grant execute on function public.push_configuration(jsonb) to service_role;
create function private.save_push_subscription(s jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.valid_session() then raise exception '請先登入';end if;
 if s is null or jsonb_typeof(s)<>'object' or coalesce(length(s::text)>4096 or s->>'endpoint' !~ '^https://' or length(s->'keys'->>'p256dh') not between 80 and 100 or length(s->'keys'->>'auth') not between 20 and 30,true) then raise exception '無效通知訂閱';end if;
 if (select count(*) from private.push_devices where user_id=auth.uid())>=10 and not exists(select 1 from private.push_devices where endpoint=s->>'endpoint' and user_id=auth.uid()) then raise exception '裝置數量已達上限';end if;
 insert into private.push_devices(user_id,endpoint,subscription) values(auth.uid(),s->>'endpoint',s) on conflict(endpoint) do update set user_id=excluded.user_id,subscription=excluded.subscription,updated_at=now();
end $$;
create function public.save_push_subscription(s jsonb) returns void language sql security invoker set search_path='' as $$select private.save_push_subscription(s)$$;
create function private.remove_push_subscription(e text) returns void language plpgsql security definer set search_path='' as $$begin if not private.valid_session() then raise exception '請先登入';end if;delete from private.push_devices where user_id=auth.uid() and endpoint=e;end $$;
create function public.remove_push_subscription(e text) returns void language sql security invoker set search_path='' as $$select private.remove_push_subscription(e)$$;
revoke all on function public.save_push_subscription(jsonb),private.save_push_subscription(jsonb),public.remove_push_subscription(text),private.remove_push_subscription(text) from public,anon;
grant execute on function public.save_push_subscription(jsonb),private.save_push_subscription(jsonb),public.remove_push_subscription(text),private.remove_push_subscription(text) to authenticated;
create function public.push_recipients(rid uuid) returns table(device_id uuid,subscription jsonb) language plpgsql security definer set search_path='' as $$
begin
 if auth.role()<>'service_role' then raise exception 'Forbidden';end if;
 return query select d.id,d.subscription from private.push_devices d join public.team_members m on m.user_id=d.user_id join public.requests r on r.team_id=m.team_id join private.accounts a on a.user_id=d.user_id and a.approved where r.id=rid and d.user_id<>r.author_id and r.status<>'cancelled';
end $$;
create function public.drop_push_device(did uuid) returns void language plpgsql security definer set search_path='' as $$begin if auth.role()<>'service_role' then raise exception 'Forbidden';end if;delete from private.push_devices where id=did;end $$;
revoke all on function public.push_recipients(uuid),public.drop_push_device(uuid) from public,anon,authenticated;
grant execute on function public.push_recipients(uuid),public.drop_push_device(uuid) to service_role;
create extension if not exists pg_net with schema extensions;
create function private.notify_new_request() returns trigger language plpgsql security definer set search_path='' as $$
declare c jsonb;
begin
 select config into c from private.push_config where id;
 if c is not null then perform net.http_post(url:='https://pfrnxaitloaiemrerhcn.supabase.co/functions/v1/team-push',body:=jsonb_build_object('requestId',new.id),headers:=jsonb_build_object('Content-Type','application/json','x-push-hook',c->>'hookSecret'),timeout_milliseconds:=10000);end if;
 return new;
exception when others then raise warning 'Team notification delivery could not be queued';return new;
end $$;
revoke all on function private.notify_new_request() from public,anon,authenticated;
create trigger push_new_request after insert on public.requests for each row execute function private.notify_new_request();
