-- Droxion 1.1 rankings backend.
-- STAGED ONLY: do not apply to production until preview approval.

create or replace function public.droxion_creator_rankings(
  p_period text default 'daily',
  p_limit integer default 100
)
returns table(
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  gift_coins bigint,
  gift_count bigint,
  unique_supporters bigint,
  is_live boolean
)
language sql
security definer
set search_path = public
as $$
  with bounds as (
    select case lower(coalesce(p_period, 'daily'))
      when 'weekly' then date_trunc('week', now())
      when 'monthly' then date_trunc('month', now())
      else date_trunc('day', now())
    end as starts_at
  ), gift_totals as (
    select
      g.recipient_id,
      sum(g.cost_coins)::bigint as gift_coins,
      count(*)::bigint as gift_count,
      count(distinct g.sender_id)::bigint as unique_supporters
    from public.droxion_live_gifts g
    cross join bounds b
    where g.created_at >= b.starts_at
    group by g.recipient_id
  )
  select
    p.user_id,
    coalesce(p.display_name, p.username, 'Droxion Creator') as display_name,
    p.username,
    p.avatar_url,
    gt.gift_coins,
    gt.gift_count,
    gt.unique_supporters,
    coalesce(lp.is_live and lp.last_seen_at > now() - interval '60 seconds', false) as is_live
  from gift_totals gt
  join public.droxion_profiles p on p.user_id = gt.recipient_id
  left join public.droxion_live_presence lp on lp.user_id = gt.recipient_id
  order by gt.gift_coins desc, gt.gift_count desc, p.user_id
  limit greatest(1, least(coalesce(p_limit, 100), 100));
$$;

revoke all on function public.droxion_creator_rankings(text, integer) from public;
grant execute on function public.droxion_creator_rankings(text, integer) to anon, authenticated;
