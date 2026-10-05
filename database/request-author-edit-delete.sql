-- Request authors may edit/delete only their own still-open posts.
create policy requests_author_update
on public.requests
for update
to authenticated
using (
  private.valid_session()
  and author_id = (select auth.uid())
  and status = 'open'
)
with check (
  private.valid_session()
  and author_id = (select auth.uid())
  and status = 'open'
  and assignee_id is null
);

create policy requests_author_delete
on public.requests
for delete
to authenticated
using (
  private.valid_session()
  and author_id = (select auth.uid())
  and status in ('open','cancelled')
);

grant update(kind,title,body,item_id,quantity,reward,reward_item_id,reward_quantity,location,scheduled_at,updated_at)
on public.requests to authenticated;
grant delete on public.requests to authenticated;
