-- Applied through Supabase migration restrict_unused_client_privileges.
revoke truncate, references, trigger on public.request_notifications from authenticated;
revoke execute on function public.admin_approve(uuid,boolean),public.admin_make(uuid),public.admin_players(),public.create_invite(uuid),public.create_team(text),public.join_team(text),public.player_status(),public.request_action(uuid,text),public.team_progress(uuid) from public,anon;
grant execute on function public.admin_approve(uuid,boolean),public.admin_make(uuid),public.admin_players(),public.create_invite(uuid),public.create_team(text),public.join_team(text),public.player_status(),public.request_action(uuid,text),public.team_progress(uuid) to authenticated,service_role;
