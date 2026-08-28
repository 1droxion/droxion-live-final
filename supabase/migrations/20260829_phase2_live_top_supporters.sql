-- Phase 2: LIVE Top Supporters leaderboard.
-- Counts all gift coins in the current active LIVE session.
-- Access is limited to the host or an active viewer of that LIVE.

create or replace function public.droxion_live_top_supporters(
  p_session_id uuid default null
)
returns table(
  rank_number bigint,
  supporter_id uuid,
  display_name text,
  username text,
  avatar_url text,
  total_coins bigint,
  gift_count bigint,
  highest_gift_coins integer,
  latest_gift_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with target as (
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
        join public.droxion_live_presence lp
          on lp.session_id = lv.session_id
         and lp.is_live = true
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
          and lp.is_live = true
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
  totals as (
    select
      g.sender_id,
      sum(g.cost_coins)::bigint as total_coins,
      count(*)::bigint as gift_count,
      max(g.cost_coins)::integer as highest_gift_coins,
      max(g.created_at) as latest_gift_at
    from public.droxion_live_gifts g
    join access_ok a
      on a.allowed
     and a.session_id = g.session_id
    where not exists (
      select 1
      from public.droxion_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_user_id = g.sender_id)
         or (b.blocker_id = g.sender_id and b.blocked_user_id = auth.uid())
    )
    group by g.sender_id
  ),
  ranked as (
    select
      row_number() over (order by t.total_coins desc, t.latest_gift_at asc, t.sender_id) as rank_number,
      t.*
    from totals t
  )
  select
    r.rank_number,
    r.sender_id as supporter_id,
    coalesce(nullif(p.display_name, ''), 'Droxion supporter') as display_name,
    nullif(p.username, '') as username,
    nullif(p.avatar_url, '') as avatar_url,
    r.total_coins,
    r.gift_count,
    r.highest_gift_coins,
    r.latest_gift_at
  from ranked r
  left join public.droxion_profiles p on p.user_id = r.sender_id
  order by r.rank_number
  limit 20;
$$;

revoke all on function public.droxion_live_top_supporters(uuid) from public;
revoke all on function public.droxion_live_top_supporters(uuid) from anon;
grant execute on function public.droxion_live_top_supporters(uuid) to authenticated;
