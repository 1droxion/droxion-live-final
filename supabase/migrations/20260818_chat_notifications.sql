create unique index if not exists droxion_notifications_live_once_idx
  on public.droxion_notifications(user_id, type, session_id)
  where session_id is not null;

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
    user_id,
    actor_id,
    type,
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
  on conflict (user_id, type, session_id)
    where session_id is not null
  do nothing;

  return new;
end;
$$;

drop trigger if exists after_droxion_live_started_notify_followers on public.droxion_live_presence;
create trigger after_droxion_live_started_notify_followers
after insert or update of is_live, session_id on public.droxion_live_presence
for each row execute function public.droxion_notify_followers_live();
