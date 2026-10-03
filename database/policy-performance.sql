alter policy "profiles_preferences" on public."profiles" using (((select private.valid_session()) AND (id = (select auth.uid())))) with check (((select private.valid_session()) AND (id = (select auth.uid()))));
alter policy "profiles_read" on public."profiles" using (((select private.valid_session()) AND ((id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM team_members m
  WHERE ((m.user_id = profiles.id) AND private.in_team(m.team_id))))))) ;
alter policy "worlds_self" on public."worlds" using (((select private.valid_session()) AND (user_id = (select auth.uid())))) with check (((select private.valid_session()) AND (user_id = (select auth.uid()))));
alter policy "progress_self" on public."progress" using (((select private.valid_session()) AND (user_id = (select auth.uid())))) with check (((select private.valid_session()) AND (user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM worlds w
  WHERE ((w.id = progress.world_id) AND (w.user_id = (select auth.uid())))))));
alter policy "requests_insert" on public."requests"  with check ((private.in_team(team_id) AND (author_id = (select auth.uid())) AND (status = 'open'::text) AND (assignee_id IS NULL)));
alter policy "comments_insert" on public."request_comments"  with check (((select private.valid_session()) AND (author_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM requests r
  WHERE ((r.id = request_comments.request_id) AND private.in_team(r.team_id))))));
alter policy "records_edit" on public."team_records" using ((private.in_team(team_id) AND ((author_id = (select auth.uid())) OR private.is_owner(team_id)))) with check ((private.in_team(team_id) AND ((author_id = (select auth.uid())) OR private.is_owner(team_id))));
alter policy "records_insert" on public."team_records"  with check ((private.in_team(team_id) AND (author_id = (select auth.uid()))));
drop index public.worlds_user;
