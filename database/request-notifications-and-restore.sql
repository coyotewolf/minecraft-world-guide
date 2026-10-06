-- Request restore and persistent order notifications (2026-10-06)
create table if not exists public.request_notifications (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.teams(id) on delete cascade,
 request_id uuid references public.requests(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 event text not null check(length(event) between 1 and 32),
 title text not null check(length(title) between 1 and 160),
 message text not null check(length(message) between 1 and 400),
 created_at timestamptz not null default now(),
 read_at timestamptz
);
create index if not exists request_notifications_user_created on public.request_notifications(user_id,created_at desc);
alter table public.request_notifications enable row level security;

drop policy if exists request_notifications_self_read on public.request_notifications;
create policy request_notifications_self_read on public.request_notifications for select to authenticated
using(private.valid_session() and user_id=(select auth.uid()));

drop policy if exists request_notifications_self_update on public.request_notifications;
create policy request_notifications_self_update on public.request_notifications for update to authenticated
using(private.valid_session() and user_id=(select auth.uid()))
with check(private.valid_session() and user_id=(select auth.uid()));

revoke all on public.request_notifications from public,anon;
grant select on public.request_notifications to authenticated;
grant update(read_at) on public.request_notifications to authenticated;

create or replace function private.request_action(rid uuid,action text) returns void
language plpgsql security definer set search_path='' as $$
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
 elsif action='restore' and r.status='cancelled' and r.author_id=auth.uid() then
  update public.requests set status='open',assignee_id=null,updated_at=now() where id=rid;
 elsif action='reopen' and r.status='submitted' and r.author_id=auth.uid() then
  update public.requests set status='claimed',updated_at=now() where id=rid;
 else
  raise exception '申請狀態已改變，或你沒有操作權限';
 end if;
end $$;

create or replace function private.request_notification_after_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if old.status is not distinct from new.status then return new; end if;

 if new.status='claimed' and old.status='submitted' then
  if new.assignee_id is not null and new.assignee_id is distinct from actor then
   insert into public.request_notifications(team_id,request_id,user_id,event,title,message)
   values(new.team_id,new.id,new.assignee_id,'reopened',new.title,'發布者退回了這張訂單，請繼續處理。');
  end if;
 elsif new.status='claimed' then
  if new.author_id is distinct from actor then
   insert into public.request_notifications(team_id,request_id,user_id,event,title,message)
   values(new.team_id,new.id,new.author_id,'claimed',new.title,'你的訂單已有人接單。');
  end if;
 elsif new.status='submitted' then
  if new.author_id is distinct from actor then
   insert into public.request_notifications(team_id,request_id,user_id,event,title,message)
   values(new.team_id,new.id,new.author_id,'submitted',new.title,'接單者已提交完成，等待你確認。');
  end if;
 elsif new.status='completed' then
  if new.assignee_id is not null and new.assignee_id is distinct from actor then
   insert into public.request_notifications(team_id,request_id,user_id,event,title,message)
   values(new.team_id,new.id,new.assignee_id,'completed',new.title,'發布者已確認完成這張訂單。');
  end if;
 elsif new.status='open' and old.status='claimed' then
  if new.author_id is distinct from actor then
   insert into public.request_notifications(team_id,request_id,user_id,event,title,message)
   values(new.team_id,new.id,new.author_id,'released',new.title,'接單者已釋出訂單，目前重新等待接單。');
  end if;
 elsif new.status='cancelled' then
  if old.assignee_id is not null and old.assignee_id is distinct from actor then
   insert into public.request_notifications(team_id,request_id,user_id,event,title,message)
   values(new.team_id,new.id,old.assignee_id,'cancelled','訂單已取消','發布者已取消這張訂單。');
  end if;
 end if;
 return new;
end $$;

revoke all on function private.request_notification_after_change() from public,anon,authenticated;
drop trigger if exists request_notification_after_change on public.requests;
create trigger request_notification_after_change after update of status on public.requests
for each row execute function private.request_notification_after_change();

do $$ begin
 alter publication supabase_realtime add table public.request_notifications;
exception when duplicate_object then null;
end $$;
