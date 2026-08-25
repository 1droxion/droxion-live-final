-- Keep droxion_live_presence and droxion_live_viewers private while allowing
-- Supabase Realtime to evaluate droxion_live_events RLS for the current user.
create or replace function public.droxion_can_read_live_event_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.droxion_live_presence lp
        where lp.session_id = p_session_id
          and lp.user_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.droxion_live_viewers v
        where v.session_id = p_session_id
          and v.viewer_id = (select auth.uid())
          and v.heartbeat_at > now() - interval '2 minutes 30 seconds'
      )
    );
$$;

revoke all on function public.droxion_can_read_live_event_session(uuid) from public;
grant execute on function public.droxion_can_read_live_event_session(uuid) to authenticated;

drop policy if exists "live events participants read" on public.droxion_live_events;
create policy "live events participants read"
on public.droxion_live_events
for select
to authenticated
using (
  event_type = any (array['live_started'::text, 'live_ended'::text])
  or target_user_id = (select auth.uid())
  or public.droxion_can_read_live_event_session(session_id)
);
