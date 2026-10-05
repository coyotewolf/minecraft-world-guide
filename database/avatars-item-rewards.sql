alter table public.profiles add column avatar_preset text not null default (array['steve','alex','creeper','zombie','skeleton','enderman','villager','piglin','wither_skeleton','husk','drowned','stray'])[1+floor(random()*12)::int]
 check(avatar_preset in ('steve','alex','creeper','zombie','skeleton','enderman','villager','piglin','wither_skeleton','husk','drowned','stray'));
alter table public.profiles add column avatar_path text;
alter table public.profiles add column avatar_updated_at timestamptz not null default now();
alter table public.profiles add constraint avatar_owned_path check(avatar_path is null or avatar_path=id::text||'/avatar.png');
grant update(avatar_preset,avatar_path,avatar_updated_at) on public.profiles to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('player-avatars','player-avatars',false,1048576,array['image/png']);
create function private.can_view_avatar(owner_key text) returns boolean language sql stable security definer set search_path='' as $$
 select private.valid_session() and (owner_key=auth.uid()::text or private.is_admin() or exists(select 1 from public.team_members m where m.user_id::text=owner_key and private.in_team(m.team_id)))
$$;
revoke all on function private.can_view_avatar(text) from public,anon;
grant execute on function private.can_view_avatar(text) to authenticated;
create policy avatar_objects_read on storage.objects for select to authenticated
 using(bucket_id='player-avatars' and private.can_view_avatar((storage.foldername(name))[1]));
create policy avatar_objects_insert on storage.objects for insert to authenticated
 with check(bucket_id='player-avatars' and private.valid_session() and name=(select auth.uid())::text||'/avatar.png');
create policy avatar_objects_update on storage.objects for update to authenticated
 using(bucket_id='player-avatars' and private.valid_session() and name=(select auth.uid())::text||'/avatar.png')
 with check(bucket_id='player-avatars' and private.valid_session() and name=(select auth.uid())::text||'/avatar.png');
create policy avatar_objects_delete on storage.objects for delete to authenticated
 using(bucket_id='player-avatars' and private.valid_session() and name=(select auth.uid())::text||'/avatar.png');

alter table public.requests add column reward_item_id text check(reward_item_id ~ '^[a-z0-9_.-]+:[a-z0-9_./-]+$' and char_length(reward_item_id)<=160);
alter table public.requests add column reward_quantity integer check(reward_quantity between 1 and 1000000);
alter table public.requests add constraint reward_pair check((reward_item_id is null)=(reward_quantity is null));
