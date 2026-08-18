create table if not exists public.droxion_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete cascade,
  type text not null check (type in ('creator_live','follow','message','gift','ranking','payout','highlight')),
  title text not null,
  body text,
  session_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists droxion_notifications_user_created_idx
  on public.droxion_notifications(user_id, created_at desc);

create unique index if not exists droxion_notifications_live_unique_idx
  on public.droxion_notifications(user_id, type, session_id)
  where type = 'creator_live' and session_id is not null;

alter table public.droxion_notifications enable row level security;

drop policy if exists "Users read own notifications" on public.droxion_notifications;
create policy "Users read own notifications"
  on public.droxion_notifications for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users update own notifications" on public.droxion_notifications;
create policy "Users update own notifications"
  on public.droxion_notifications for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.droxion_my_notifications(p_limit integer default 50)
returns table(
  id uuid,
  type text,
  title text,
  body text,
  actor_id uuid,
  actor_name text,
  actor_avatar text,
  session_id uuid,
  read_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  select
    n.id,
    n.type,
    n.title,
    n.body,
    n.actor_id,
    coalesce(p.display_name, 'Droxion') as actor_name,
    p.avatar_url as actor_avatar,
    n.session_id,
    n.read_at,
    n.created_at
  from public.droxion_notifications n
  left join public.droxion_profiles p on p.user_id = n.actor_id
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit,50),100));
$$;

create or replace function public.droxion_mark_notifications_read()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  update public.droxion_notifications
  set read_at = coalesce(read_at, now())
  where user_id = auth.uid() and read_at is null;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.droxion_my_notifications(integer) to authenticated;
grant execute on function public.droxion_mark_notifications_read() to authenticated;

create or replace function public.droxion_start_live(p_title text, p_tags text[], p_orientation text, p_allow_guest_requests boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_presence public.droxion_live_presence%rowtype;
  v_orientation text := case when lower(coalesce(p_orientation,''))='horizontal' then 'horizontal' else 'vertical' end;
  v_title text := left(coalesce(nullif(trim(p_title),''),'Live on Droxion'),100);
  v_tags text[];
begin
  if v_user is null then raise exception 'Authentication required.'; end if;

  select coalesce(array_agg(left(trim(x),24)) filter (where trim(x)<>''), '{}'::text[])
    into v_tags
  from unnest(coalesce(p_tags,'{}'::text[])) as x;
  v_tags := v_tags[1:8];

  insert into public.droxion_live_presence(
    user_id, session_id, is_live, started_at, last_seen_at, ended_at, updated_at,
    title, tags, orientation, allow_guest_requests
  ) values (
    v_user, gen_random_uuid(), true, now(), now(), null, now(),
    v_title, v_tags, v_orientation, coalesce(p_allow_guest_requests,true)
  )
  on conflict (user_id) do update set
    session_id = case
      when public.droxion_live_presence.is_live is false
        or public.droxion_live_presence.last_seen_at is null
        or public.droxion_live_presence.last_seen_at < now() - interval '60 seconds'
      then gen_random_uuid()
      else public.droxion_live_presence.session_id
    end,
    is_live = true,
    started_at = case
      when public.droxion_live_presence.is_live is false
        or public.droxion_live_presence.last_seen_at is null
        or public.droxion_live_presence.last_seen_at < now() - interval '60 seconds'
      then now()
      else public.droxion_live_presence.started_at
    end,
    last_seen_at = now(),
    ended_at = null,
    updated_at = now(),
    title = v_title,
    tags = v_tags,
    orientation = v_orientation,
    allow_guest_requests = coalesce(p_allow_guest_requests,true)
  returning * into v_presence;

  insert into public.droxion_notifications(user_id, actor_id, type, title, body, session_id)
  select
    f.follower_id,
    v_user,
    'creator_live',
    coalesce(p.display_name,'A creator you follow') || ' is LIVE',
    v_title,
    v_presence.session_id
  from public.droxion_follows f
  left join public.droxion_profiles p on p.user_id = v_user
  where f.followed_id = v_user
    and f.follower_id <> v_user
  on conflict do nothing;

  return jsonb_build_object(
    'is_live',v_presence.is_live,
    'session_id',v_presence.session_id,
    'started_at',v_presence.started_at,
    'title',v_presence.title,
    'tags',v_presence.tags,
    'orientation',v_presence.orientation,
    'allow_guest_requests',v_presence.allow_guest_requests
  );
end;
$$;
