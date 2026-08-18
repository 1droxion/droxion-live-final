create table if not exists public.droxion_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text,
  session_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists droxion_notifications_live_once_idx
  on public.droxion_notifications(recipient_id, notification_type, session_id)
  where session_id is not null;

create index if not exists droxion_notifications_recipient_created_idx
  on public.droxion_notifications(recipient_id, created_at desc);

create index if not exists droxion_notifications_unread_idx
  on public.droxion_notifications(recipient_id, created_at desc)
  where read_at is null;

alter table public.droxion_notifications enable row level security;

drop policy if exists "Users read own Droxion notifications" on public.droxion_notifications;
create policy "Users read own Droxion notifications"
  on public.droxion_notifications
  for select
  to authenticated
  using (auth.uid() = recipient_id);

drop policy if exists "Users update own Droxion notifications" on public.droxion_notifications;
create policy "Users update own Droxion notifications"
  on public.droxion_notifications
  for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

create or replace function public.droxion_chat_participants()
returns table(
  user_id uuid,
  display_name text,
  avatar_url text,
  allow_messages boolean,
  blocked boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with me as (
    select auth.uid() as id
  ), participant_ids as (
    select distinct
      case when m.sender_id = me.id then m.recipient_id else m.sender_id end as user_id
    from public.droxion_direct_messages m
    cross join me
    where me.id is not null
      and (m.sender_id = me.id or m.recipient_id = me.id)
    union
    select f.followed_id
    from public.droxion_follows f
    cross join me
    where me.id is not null and f.follower_id = me.id
  )
  select
    p.user_id,
    coalesce(nullif(btrim(p.display_name), ''), nullif('@' || btrim(p.username), '@'), 'Droxion member') as display_name,
    p.avatar_url,
    coalesce(p.allow_messages, false) as allow_messages,
    exists (
      select 1
      from public.droxion_blocks b
      cross join me
      where (b.blocker_id = me.id and b.blocked_user_id = p.user_id)
         or (b.blocker_id = p.user_id and b.blocked_user_id = me.id)
    ) as blocked
  from participant_ids x
  join public.droxion_profiles p on p.user_id = x.user_id;
$$;

revoke all on function public.droxion_chat_participants() from public;
grant execute on function public.droxion_chat_participants() to authenticated;

create or replace function public.droxion_my_notifications(p_limit integer default 50)
returns table(
  id uuid,
  notification_type text,
  actor_id uuid,
  actor_name text,
  actor_avatar_url text,
  title text,
  body text,
  session_id uuid,
  read_at timestamptz,
  created_at timestamptz,
  is_live boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    n.id,
    n.notification_type,
    n.actor_id,
    coalesce(nullif(btrim(p.display_name), ''), 'Creator') as actor_name,
    p.avatar_url as actor_avatar_url,
    n.title,
    n.body,
    n.session_id,
    n.read_at,
    n.created_at,
    coalesce(lp.is_live, false)
      and lp.session_id = n.session_id
      and lp.last_seen_at >= now() - interval '60 seconds' as is_live
  from public.droxion_notifications n
  left join public.droxion_profiles p on p.user_id = n.actor_id
  left join public.droxion_live_presence lp on lp.user_id = n.actor_id
  where n.recipient_id = auth.uid()
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

revoke all on function public.droxion_my_notifications(integer) from public;
grant execute on function public.droxion_my_notifications(integer) to authenticated;

create or replace function public.droxion_notify_followers_live()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_name text;
begin
  if new.is_live is not true then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.is_live is true
     and old.session_id is not distinct from new.session_id then
    return new;
  end if;

  select coalesce(nullif(btrim(display_name), ''), 'A creator')
    into v_name
  from public.droxion_profiles
  where user_id = new.user_id;

  v_name := coalesce(v_name, 'A creator');

  insert into public.droxion_notifications(
    recipient_id,
    actor_id,
    notification_type,
    title,
    body,
    session_id
  )
  select
    f.follower_id,
    new.user_id,
    'live_started',
    v_name || ' is LIVE',
    coalesce(nullif(btrim(new.title), ''), 'Live on Droxion'),
    new.session_id
  from public.droxion_follows f
  where f.followed_id = new.user_id
    and f.follower_id <> new.user_id
  on conflict (recipient_id, notification_type, session_id)
    where session_id is not null
  do nothing;

  return new;
end;
$$;

drop trigger if exists after_droxion_live_started_notify_followers on public.droxion_live_presence;
create trigger after_droxion_live_started_notify_followers
after insert or update of is_live, session_id on public.droxion_live_presence
for each row execute function public.droxion_notify_followers_live();
