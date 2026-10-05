-- Run as database owner; all fixtures and notifications are rolled back.
begin;
create temporary table fixture as select gen_random_uuid() author,gen_random_uuid() teammate,gen_random_uuid() stranger,gen_random_uuid() team,gen_random_uuid() item,gen_random_uuid() mission,gen_random_uuid() sa,gen_random_uuid() sb,gen_random_uuid() sc;
insert into auth.users(id) select author from fixture union all select teammate from fixture union all select stranger from fixture;
insert into public.profiles(id,game_id) select author,'PrivacyAuthor' from fixture union all select teammate,'PrivacyTeammate' from fixture union all select stranger,'PrivacyStranger' from fixture;
insert into private.accounts(user_id,game_key,recovery_hash,approved) select id,id::text,'test-only',true from public.profiles where id in (select author from fixture union all select teammate from fixture union all select stranger from fixture);
insert into auth.sessions(id,user_id) select sa,author from fixture union all select sb,teammate from fixture union all select sc,stranger from fixture;
insert into public.teams(id,owner_id,name) select team,teammate,'Privacy fixture' from fixture;
insert into public.team_members(team_id,user_id) select team,author from fixture union all select team,teammate from fixture;
insert into public.requests(id,team_id,author_id,title,kind) select item,team,author,'Cancelled item','item' from fixture union all select mission,team,author,'Cancelled mission','mission' from fixture;
insert into public.request_comments(request_id,author_id,body) select item,teammate,'Private after cancellation' from fixture union all select mission,author,'Private invitation' from fixture;
grant select on fixture to authenticated,anon;
select set_config('request.jwt.claims',json_build_object('sub',teammate,'session_id',sb)::text,true) from fixture;
set local role authenticated;
do $$begin
 if (select count(*) from public.requests where team_id=(select team from fixture))<>2 then raise exception 'Teammate cannot see open requests';end if;
end$$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',author,'session_id',sa)::text,true) from fixture;
set local role authenticated;
select public.request_action(item,'cancel'),public.request_action(mission,'cancel') from fixture;
do $$begin
 if (select count(*) from public.requests where team_id=(select team from fixture))<>2 then raise exception 'Author lost cancelled requests';end if;
 if (select count(*) from public.request_comments where request_id in (select item from fixture union all select mission from fixture))<>2 then raise exception 'Author lost comments';end if;
 if (select requests_revision from public.teams where id=(select team from fixture))<>2 then raise exception 'Missing cancellation invalidation';end if;
end$$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',teammate,'session_id',sb)::text,true) from fixture;
set local role authenticated;
do $$begin
 if exists(select 1 from public.requests where team_id=(select team from fixture)) then raise exception 'Teammate can read cancelled requests';end if;
 if exists(select 1 from public.request_comments where request_id in (select item from fixture union all select mission from fixture)) then raise exception 'Teammate can read cancelled comments';end if;
 begin
 insert into public.request_comments(request_id,author_id,body) select item,teammate,'Unauthorized' from fixture;
 raise exception 'Teammate can add comment';
 exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',stranger,'session_id',sc)::text,true) from fixture;
set local role authenticated;
do $$begin
 if exists(select 1 from public.requests where team_id=(select team from fixture)) or exists(select 1 from public.teams where id=(select team from fixture)) then raise exception 'Stranger can read team data';end if;
end$$;
reset role;
set local role anon;
do $$begin
 begin perform count(*) from public.requests;raise exception 'Guest can read requests';exception when insufficient_privilege then null;end;
end$$;
reset role;
select 'PASS: open requests visible; cancelled items/missions/comments author only; team revision; denied comment insert, stranger and guest' as result;
rollback;
