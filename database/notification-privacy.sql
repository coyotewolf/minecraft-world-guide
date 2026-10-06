revoke update on public.request_notifications from authenticated;
grant update(read_at) on public.request_notifications to authenticated;
create index if not exists request_notifications_request_idx on public.request_notifications(request_id);
create index if not exists request_notifications_team_idx on public.request_notifications(team_id);
create index if not exists push_devices_user_idx on private.push_devices(user_id);
CREATE OR REPLACE FUNCTION private.request_notification_after_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
