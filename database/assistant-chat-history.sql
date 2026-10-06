-- Account-scoped assistant chat history.
-- Applied to Supabase project pfrnxaitloaiemrerhcn on 2026-10-06.

create table if not exists public.assistant_conversations (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '新對話' check (char_length(title) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.assistant_messages (
  id uuid primary key,
  conversation_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  text text not null default '' check (char_length(text) <= 8000),
  facts jsonb not null default '[]'::jsonb
    check (jsonb_typeof(facts) = 'array' and octet_length(facts::text) <= 250000),
  created_at timestamptz not null default now(),
  foreign key (conversation_id, user_id)
    references public.assistant_conversations(id, user_id) on delete cascade
);

create index if not exists assistant_conversations_user_updated
  on public.assistant_conversations(user_id, updated_at desc);
create index if not exists assistant_messages_conversation_created
  on public.assistant_messages(conversation_id, created_at desc, id);

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;

drop policy if exists assistant_conversations_self_select on public.assistant_conversations;
create policy assistant_conversations_self_select
on public.assistant_conversations for select to authenticated
using (private.valid_session() and user_id = (select auth.uid()));

drop policy if exists assistant_conversations_self_insert on public.assistant_conversations;
create policy assistant_conversations_self_insert
on public.assistant_conversations for insert to authenticated
with check (private.valid_session() and user_id = (select auth.uid()));

drop policy if exists assistant_conversations_self_update on public.assistant_conversations;
create policy assistant_conversations_self_update
on public.assistant_conversations for update to authenticated
using (private.valid_session() and user_id = (select auth.uid()))
with check (private.valid_session() and user_id = (select auth.uid()));

drop policy if exists assistant_conversations_self_delete on public.assistant_conversations;
create policy assistant_conversations_self_delete
on public.assistant_conversations for delete to authenticated
using (private.valid_session() and user_id = (select auth.uid()));

drop policy if exists assistant_messages_self_select on public.assistant_messages;
create policy assistant_messages_self_select
on public.assistant_messages for select to authenticated
using (private.valid_session() and user_id = (select auth.uid()));

drop policy if exists assistant_messages_self_insert on public.assistant_messages;
create policy assistant_messages_self_insert
on public.assistant_messages for insert to authenticated
with check (private.valid_session() and user_id = (select auth.uid()));

drop policy if exists assistant_messages_self_delete on public.assistant_messages;
create policy assistant_messages_self_delete
on public.assistant_messages for delete to authenticated
using (private.valid_session() and user_id = (select auth.uid()));

revoke all on public.assistant_conversations, public.assistant_messages from public, anon;
grant select, insert, update, delete on public.assistant_conversations to authenticated;
grant select, insert, delete on public.assistant_messages to authenticated;
