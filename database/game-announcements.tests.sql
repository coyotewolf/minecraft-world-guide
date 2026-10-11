begin;
insert into public.game_announcements(id,title,body,created_at,expires_at,withdrawn) values
 ('00000000-0000-4000-8000-000000001001','test-active','transaction-only',now(),now()+interval '1 hour',false),
 ('00000000-0000-4000-8000-000000001002','test-withdrawn','transaction-only',now(),now()+interval '1 hour',true),
 ('00000000-0000-4000-8000-000000001003','test-expired','transaction-only',now()-interval '2 hours',now()-interval '1 hour',false);
set local role anon;
do $$ begin
 if (select count(*) from public.game_announcements where id in ('00000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000001003'))<>1 then raise exception 'public visibility failed'; end if;
 begin perform public.publish_game_announcement('test','test',1);raise exception 'anon publish allowed';exception when insufficient_privilege then null;end;
 begin update public.game_announcements set withdrawn=true;raise exception 'anon update allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 begin perform public.publish_game_announcement('test','test',1);raise exception 'unapproved publish allowed';exception when insufficient_privilege then null;end;
 begin perform public.withdraw_game_announcement('00000000-0000-4000-8000-000000001001');raise exception 'unapproved withdraw allowed';exception when insufficient_privilege then null;end;
 begin insert into public.game_announcements(title,body,expires_at) values('test','test',now()+interval '1 hour');raise exception 'direct insert allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'six permission/visibility checks passed; transaction rolled back' as result;
rollback;
