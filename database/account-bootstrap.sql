create function public.account_bootstrap() returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare state jsonb;own_profile jsonb;own_world jsonb;wid uuid;rows jsonb;visible_teams jsonb;more boolean;
begin
 state=public.player_status();
 if not coalesce((state->>'active')::boolean,false) then return jsonb_build_object('status',state);end if;
 select to_jsonb(p) into own_profile from public.profiles p where p.id=auth.uid();
 select to_jsonb(w),w.id into own_world,wid from public.worlds w where w.user_id=auth.uid() order by w.created_at,w.id limit 1;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.record_key),'[]'::jsonb) into rows from(select * from public.progress where user_id=auth.uid() and world_id=wid order by record_key limit 1000)x;
 select exists(select 1 from public.progress where user_id=auth.uid() and world_id=wid order by record_key offset 1000 limit 1) into more;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at,t.id),'[]'::jsonb) into visible_teams from public.teams t;
 return jsonb_build_object('status',state,'profile',own_profile,'world',own_world,'progress',rows,'progress_more',more,'teams',visible_teams);
end $fn$;
revoke all on function public.account_bootstrap() from public,anon;
grant execute on function public.account_bootstrap() to authenticated;

