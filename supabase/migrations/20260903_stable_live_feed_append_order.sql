-- Keep an actively viewed LIVE grid stable while presence refreshes.
-- Oldest active LIVE stays first; newly started LIVE sessions append at the end
-- instead of being inserted above users who are already scrolling the grid.

create or replace function public.droxion_live_feed()
returns table(
  user_id uuid,
  session_id uuid,
  display_name text,
  age integer,
  country text,
  language text,
  gender text,
  avatar_url text,
  title text,
  tags text[],
  orientation text,
  allow_guest_requests boolean,
  viewer_count bigint,
  started_at timestamptz
)
language sql
stable security definer
set search_path to 'public', 'auth'
as $function$
  select
    p.user_id,
    lp.session_id,
    coalesce(nullif(p.display_name,''),'Droxion user'),
    extract(year from age(current_date,p.date_of_birth))::integer,
    case when p.show_country then coalesce(p.country,'') else '' end,
    coalesce(p.language,''),
    coalesce(p.gender,''),
    p.avatar_url,
    coalesce(nullif(lp.title,''),'Live on Droxion'),
    coalesce(lp.tags,'{}'::text[]),
    coalesce(lp.orientation,'vertical'),
    coalesce(lp.allow_guest_requests,true),
    (
      select count(*)
      from public.droxion_live_viewers v
      where v.session_id=lp.session_id
        and v.viewer_id<>lp.user_id
        and v.heartbeat_at>now()-interval '150 seconds'
    ),
    lp.started_at
  from public.droxion_live_presence lp
  join public.droxion_profiles p on p.user_id=lp.user_id
  where lp.is_live is true
    and lp.last_seen_at>now()-interval '3 minutes'
    and p.discovery_enabled is true
    and not exists(
      select 1 from public.droxion_blocks b
      where b.blocker_id=auth.uid() and b.blocked_user_id=lp.user_id
    )
    and not exists(
      select 1 from public.droxion_blocks b
      where b.blocker_id=lp.user_id and b.blocked_user_id=auth.uid()
    )
  order by lp.started_at asc
  limit 150;
$function$;
