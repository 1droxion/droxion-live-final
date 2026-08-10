begin;

create table if not exists public.droxion_direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);

create index if not exists droxion_direct_messages_pair_idx
  on public.droxion_direct_messages(sender_id, recipient_id, created_at);

alter table public.droxion_direct_messages enable row level security;

revoke all on public.droxion_direct_messages from public, anon;
grant select, insert, update on public.droxion_direct_messages to authenticated;

drop policy if exists "messages participants read" on public.droxion_direct_messages;
create policy "messages participants read"
  on public.droxion_direct_messages
  for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "messages sender insert" on public.droxion_direct_messages;
create policy "messages sender insert"
  on public.droxion_direct_messages
  for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1
      from public.droxion_profiles p
      where p.user_id = recipient_id
        and p.allow_messages = true
    )
    and not exists (
      select 1
      from public.droxion_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_user_id = recipient_id)
         or (b.blocker_id = recipient_id and b.blocked_user_id = auth.uid())
    )
  );

drop policy if exists "messages recipient mark read" on public.droxion_direct_messages;
create policy "messages recipient mark read"
  on public.droxion_direct_messages
  for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

commit;
