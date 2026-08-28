-- Phase 2: secure, session-scoped supporter spotlight / Galaxy Wall.
-- This is read-only presentation logic. It does not change gift prices,
-- wallets, creator payouts, or the LIVE media path.

create or replace function public.droxion_live_supporter_spotlights(
  p_session_id uuid default null
)
returns table(
  supporter_id uuid,
  display_name text,
  username text,
  avatar_url text,
  total_coins bigint,
  highest_gift_coins integer,
  latest_gift_name text,
  latest_emoji text,
  latest_gift_at timestamptz,
  expires_at timestamptz,
  full_live boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with recursive target as (
    select coalesce(
      p_session_id,
      (
        select lp.session_id
        from public.droxion_live_presence lp
        where lp.user_id = auth.uid()
          and lp.is_live = true
        order by lp.started_at desc nulls last, lp.updated_at desc
        limit 1
      ),
      (
        select lv.session_id
        from public.droxion_live_viewers lv
        where lv.viewer_id = auth.uid()
          and lv.heartbeat_at > now() - interval '2 minutes'
        order by lv.heartbeat_at desc
        limit 1
      )
    ) as session_id
  ),
  access_ok as (
    select
      t.session_id,
      exists (
        select 1
        from public.droxion_live_presence lp
        where lp.session_id = t.session_id
          and (
            lp.user_id = auth.uid()
            or exists (
              select 1
              from public.droxion_live_viewers lv
              where lv.session_id = t.session_id
                and lv.viewer_id = auth.uid()
                and lv.heartbeat_at > now() - interval '2 minutes'
            )
          )
      ) as allowed
    from target t
    where t.session_id is not null
  ),
  qualified as (
    select
      g.id,
      g.sender_id,
      g.gift_name,
      g.emoji,
      g.cost_coins,
      g.created_at,
      case
        when g.cost_coins >= 20000 then null::interval
        when g.cost_coins >= 5000 then interval '3 hours'
        when g.cost_coins >= 3000 then interval '1 hour'
        else interval '30 minutes'
      end as added_time,
      row_number() over (
        partition by g.sender_id
        order by g.created_at asc, g.id asc
      ) as rn
    from public.droxion_live_gifts g
    join access_ok a on a.allowed and a.session_id = g.session_id
    where g.cost_coins >= 1000
  ),
  timeline as (
    select
      q.sender_id,
      q.rn,
      q.gift_name,
      q.emoji,
      q.cost_coins,
      q.created_at,
      q.cost_coins::bigint as total_coins,
      q.cost_coins as highest_gift_coins,
      (q.cost_coins >= 20000) as full_live,
      case
        when q.cost_coins >= 20000 then null::timestamptz
        else q.created_at + q.added_time
      end as expires_at
    from qualified q
    where q.rn = 1

    union all

    select
      q.sender_id,
      q.rn,
      q.gift_name,
      q.emoji,
      q.cost_coins,
      q.created_at,
      t.total_coins + q.cost_coins::bigint,
      greatest(t.highest_gift_coins, q.cost_coins),
      (t.full_live or q.cost_coins >= 20000),
      case
        when t.full_live or q.cost_coins >= 20000 then null::timestamptz
        else greatest(t.expires_at, q.created_at) + q.added_time
      end
    from timeline t
    join qualified q
      on q.sender_id = t.sender_id
     and q.rn = t.rn + 1
  ),
  latest as (
    select distinct on (t.sender_id)
      t.sender_id,
      t.gift_name,
      t.emoji,
      t.total_coins,
      t.highest_gift_coins,
      t.created_at,
      t.expires_at,
      t.full_live
    from timeline t
    order by t.sender_id, t.rn desc
  )
  select
    l.sender_id as supporter_id,
    coalesce(nullif(p.display_name, ''), 'Droxion supporter') as display_name,
    nullif(p.username, '') as username,
    nullif(p.avatar_url, '') as avatar_url,
    l.total_coins,
    l.highest_gift_coins,
    l.gift_name as latest_gift_name,
    l.emoji as latest_emoji,
    l.created_at as latest_gift_at,
    l.expires_at,
    l.full_live
  from latest l
  left join public.droxion_profiles p on p.user_id = l.sender_id
  where l.full_live or l.expires_at > now()
  order by l.full_live desc, l.total_coins desc, l.created_at desc
  limit 20;
$$;

revoke all on function public.droxion_live_supporter_spotlights(uuid) from public;
revoke all on function public.droxion_live_supporter_spotlights(uuid) from anon;
grant execute on function public.droxion_live_supporter_spotlights(uuid) to authenticated;
