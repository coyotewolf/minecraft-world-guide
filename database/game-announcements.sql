-- Public content; no user IDs or secrets in this table. Writes require approved
-- live admin session + AAL2 through private.is_admin(). No direct client writes.
create table public.game_announcements (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(title) between 1 and 80),
 body text not null check (char_length(body) between 1 and 500),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 withdrawn boolean not null default false,
 check(expires_at>created_at and expires_at<=created_at+interval '30 days')
);
alter table public.game_announcements enable row level security;
revoke all on public.game_announcements from public,anon,authenticated;
grant select on public.game_announcements to anon,authenticated;
grant all on public.game_announcements to service_role;
create policy public_active_game_notices on public.game_announcements for select to anon
 using (not withdrawn and expires_at>now());
create policy authenticated_game_notices on public.game_announcements for select to authenticated
 using ((not withdrawn and expires_at>now()) or (select private.is_admin()));

create function private.publish_game_announcement(t text,b text,h integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare notice_id uuid;
begin
 if not private.is_admin() then raise exception 'administrator MFA required' using errcode='42501'; end if;
 if h is null or h<1 or h>720 or t is null or b is null or char_length(btrim(t)) not between 1 and 80 or char_length(btrim(b)) not between 1 and 500
 or t ~ '[[:cntrl:]]' or replace(b,chr(10),'') ~ '[[:cntrl:]]' or position('§' in t)>0 or position('§' in b)>0
 or (t||b) ~ ('['||chr(8238)||chr(8294)||'-'||chr(8297)||']')
 then raise exception 'invalid announcement' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(814716);
 if (select count(*) from public.game_announcements where not withdrawn and expires_at>now())>=20 then
 raise exception '最多同時發布 20 則公告，請先撤回舊公告。' using errcode='22023'; end if;
 insert into public.game_announcements(title,body,expires_at) values(btrim(t),btrim(b),now()+make_interval(hours=>h)) returning id into notice_id;
 return notice_id;
end $$;
create function private.withdraw_game_announcement(n uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'administrator MFA required' using errcode='42501'; end if;
 update public.game_announcements set withdrawn=true where id=n;
end $$;
revoke all on function private.publish_game_announcement(text,text,integer),private.withdraw_game_announcement(uuid) from public,anon,authenticated;
grant execute on function private.publish_game_announcement(text,text,integer),private.withdraw_game_announcement(uuid) to authenticated;
create function public.publish_game_announcement(t text,b text,h integer) returns uuid
language sql security invoker set search_path='' as $$ select private.publish_game_announcement(t,b,h) $$;
create function public.withdraw_game_announcement(n uuid) returns void
language sql security invoker set search_path='' as $$ select private.withdraw_game_announcement(n) $$;
revoke all on function public.publish_game_announcement(text,text,integer),public.withdraw_game_announcement(uuid) from public,anon,authenticated;
grant execute on function public.publish_game_announcement(text,text,integer),public.withdraw_game_announcement(uuid) to authenticated;
