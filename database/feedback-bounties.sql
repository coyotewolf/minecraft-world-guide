create table public.feedback (
 id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id),
 title text not null check(char_length(trim(title)) between 1 and 60),
 body text not null check(char_length(trim(body)) between 1 and 4000),
 kind text not null default 'issue' check(kind in ('issue','idea')),
 status text not null default 'not_started' check(status in ('not_started','reviewed','in_progress','completed')),
 admin_reply text not null default '' check(char_length(admin_reply)<=4000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index feedback_author_created on public.feedback(author_id,created_at desc);
create index feedback_status_created on public.feedback(status,created_at desc);
alter table public.feedback enable row level security;
revoke all on public.feedback from public,anon,authenticated;
grant select on public.feedback to authenticated;
grant insert(author_id,title,body,kind) on public.feedback to authenticated;
create policy feedback_read on public.feedback for select to authenticated using(private.valid_session() and (author_id=(select auth.uid()) or private.is_admin()));
create policy feedback_submit on public.feedback for insert to authenticated with check(private.valid_session() and author_id=(select auth.uid()) and status='not_started' and admin_reply='');
create function private.review_feedback(f uuid,s text,reply text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.valid_session() or not private.is_admin() then raise exception '需要網站管理員權限';end if;
 if s is null or s not in ('not_started','reviewed','in_progress','completed') then raise exception '無效狀態';end if;
 update public.feedback set status=s,admin_reply=coalesce(reply,''),updated_at=now() where id=f;
 if not found then raise exception '找不到反饋';end if;
end $$;
create function public.review_feedback(f uuid,s text,reply text default '') returns void language sql security invoker set search_path='' as $$select private.review_feedback(f,s,reply)$$;
revoke all on function private.review_feedback(uuid,text,text),public.review_feedback(uuid,text,text) from public,anon;
grant execute on function private.review_feedback(uuid,text,text),public.review_feedback(uuid,text,text) to authenticated;

alter table public.requests add column item_id text not null default '' check(char_length(item_id)<=160);
alter table public.requests add column reward text not null default '' check(char_length(reward)<=120);
create function private.validate_request_post() returns trigger language plpgsql set search_path='' as $$
begin
 if char_length(trim(new.title)) not between 1 and 32 then raise exception '標題請使用 1 至 32 字';end if;
 if new.kind='item' and (new.quantity is null or new.quantity<1) then raise exception '物品申請請填數量';end if;
 return new;
end $$;
revoke all on function private.validate_request_post() from public,anon,authenticated;
create trigger request_post_validation before insert on public.requests for each row execute function private.validate_request_post();
