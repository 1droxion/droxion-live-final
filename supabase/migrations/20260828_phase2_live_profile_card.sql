-- Phase 2: public-safe LIVE mini profile card.
-- Read-only presentation data for authenticated LIVE participants.
-- Follow/unfollow writes continue to use the existing RLS-protected droxion_follows table.

create or replace function public.droxion_live_profile_card(
  p_user_id uuid
)
returns table(
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  bio text,
  country text,
  followers_count bigint,
  following_count bigint,
  is_following boolean,
  is_self boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    p.user_id,
    coalesce(nullif(p.display_name, ''), 'Droxion user') as display_name,
    nullif(p.username, '') as username,
    nullif(p.avatar_url, '') as avatar_url,
    nullif(p.bio, '') as bio,
    case when p.show_country then nullif(p.country, '') else null end as country,
    (select count(*) from public.droxion_follows f where f.followed_id = p.user_id) as followers_count,
    (select count(*) from public.droxion_follows f where f.follower_id = p.user_id) as following_count,
    exists(
      select 1
      from public.droxion_follows f
      where f.follower_id = auth.uid()
        and f.followed_id = p.user_id
    ) as is_following,
    (auth.uid() = p.user_id) as is_self
  from public.droxion_profiles p
  where p.user_id = p_user_id
    and auth.uid() is not null
    and not exists (
      select 1
      from public.droxion_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_user_id = p.user_id)
         or (b.blocker_id = p.user_id and b.blocked_user_id = auth.uid())
    )
  limit 1;
$$;

revoke all on function public.droxion_live_profile_card(uuid) from public;
revoke all on function public.droxion_live_profile_card(uuid) from anon;
grant execute on function public.droxion_live_profile_card(uuid) to authenticated;
