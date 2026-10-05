-- Cancelled requests and their comments remain readable only by the author.
alter policy requests_read on public.requests using (
 private.in_team(team_id) and (status <> 'cancelled' or author_id = (select auth.uid()))
);

-- A cancelled row no longer passes teammates' realtime SELECT policy. Publish
-- only a team revision so their open request list can discard its cached card.
alter table public.teams add column requests_revision bigint not null default 0;
create function private.request_list_changed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.teams set requests_revision=requests_revision+1 where id=new.team_id;
 return new;
end $$;
revoke all on function private.request_list_changed() from public,anon,authenticated;
create trigger cancelled_request_list_changed after update of status on public.requests
for each row when (old.status is distinct from new.status and new.status='cancelled')
execute function private.request_list_changed();
alter publication supabase_realtime add table public.teams;
