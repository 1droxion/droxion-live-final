-- Phase 2: creator-only active LIVE audience list.
-- Exposes only public-safe profile fields for viewers actively watching the host's LIVE.

create or replace function public.droxion_live_host_audience(
  p_session_id uuid
)
returns table(
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  country text,
  joined_at timestamptz,
  heartbeat_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    p.user_id,
    coalesce(nullif(p.display_name, ''), 'Droxion viewer') as display_name,
    nullif(p.username, '') as username,
    nullif(p.avatar_url, '') as avatar_url,
    case when p.show_country then coalesce(p.country, '') else '' end as country,
    v.joined_at,
    v.heartbeat_at
  from public.droxion_live_viewers v
  join public.droxion_live_presence lp
    on lp.session_id = v.session_id
   and lp.is_live = true
  join public.droxion_profiles p
    on p.user_id = v.viewer_id
  where v.session_id = p_session_id
    and lp.user_id = auth.uid()
    and v.viewer_id <> lp.user_id
    and v.heartbeat_at > now() - interval '150 seconds'
    and not exists (
      select 1
      from public.droxion_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_user_id = v.viewer_id)
         or (b.blocker_id = v.viewer_id and b.blocked_user_id = auth.uid())
    )
  order by v.joined_at asc, v.viewer_id
  limit 100;
$$;

revoke all on function public.droxion_live_host_audience(uuid) from public;
revoke all on function public.droxion_live_host_audience(uuid) from anon;
grant execute on function public.droxion_live_host_audience(uuid) to authenticated;
