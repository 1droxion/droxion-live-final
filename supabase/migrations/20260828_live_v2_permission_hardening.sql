-- Droxion LIVE V2 permission hardening
-- Safe rollout: this migration changes database EXECUTE permissions only.
-- It does NOT modify Camera LIVE, LiveKit transport, media publishing, viewer playback,
-- or the implementation/body of any LIVE RPC.
--
-- Public discovery remains intentionally unchanged here. In particular,
-- droxion_live_profiles() and droxion_discover_profiles(...) are not modified
-- by this migration so discovery behavior is not accidentally broken.

begin;

-- Private/mutating LIVE V2 control-plane RPCs must require an authenticated user.
revoke execute on function public.droxion_start_live_v2(uuid, text, text[], text, boolean)
  from public, anon;
grant execute on function public.droxion_start_live_v2(uuid, text, text[], text, boolean)
  to authenticated;

revoke execute on function public.droxion_end_live_v2(uuid)
  from public, anon;
grant execute on function public.droxion_end_live_v2(uuid)
  to authenticated;

revoke execute on function public.droxion_live_heartbeat_v2(uuid)
  from public, anon;
grant execute on function public.droxion_live_heartbeat_v2(uuid)
  to authenticated;

-- User-specific LIVE state helpers should never be callable anonymously.
revoke execute on function public.droxion_live_status()
  from public, anon;
grant execute on function public.droxion_live_status()
  to authenticated;

revoke execute on function public.droxion_my_active_live_guest()
  from public, anon;
grant execute on function public.droxion_my_active_live_guest()
  to authenticated;

revoke execute on function public.droxion_my_active_live_viewing()
  from public, anon;
grant execute on function public.droxion_my_active_live_viewing()
  to authenticated;

revoke execute on function public.droxion_can_read_live_event_session(uuid)
  from public, anon;
grant execute on function public.droxion_can_read_live_event_session(uuid)
  to authenticated;

-- Gift catalog/events are part of an authenticated LIVE room experience.
-- Sending gifts was already authenticated; this closes anonymous read access
-- to the private LIVE gift RPC layer without changing gift economics.
revoke execute on function public.droxion_gift_options()
  from public, anon;
grant execute on function public.droxion_gift_options()
  to authenticated;

revoke execute on function public.droxion_live_gift_events(uuid, timestamptz)
  from public, anon;
grant execute on function public.droxion_live_gift_events(uuid, timestamptz)
  to authenticated;

-- Fail the migration if the intended permission boundary is not actually in place.
do $$
declare
  fn text;
  protected_functions text[] := array[
    'public.droxion_start_live_v2(uuid,text,text[],text,boolean)',
    'public.droxion_end_live_v2(uuid)',
    'public.droxion_live_heartbeat_v2(uuid)',
    'public.droxion_live_status()',
    'public.droxion_my_active_live_guest()',
    'public.droxion_my_active_live_viewing()',
    'public.droxion_can_read_live_event_session(uuid)',
    'public.droxion_gift_options()',
    'public.droxion_live_gift_events(uuid,timestamp with time zone)'
  ];
begin
  foreach fn in array protected_functions loop
    if has_function_privilege('anon', fn, 'EXECUTE') then
      raise exception 'Security hardening failed: anon can still execute %', fn;
    end if;
    if not has_function_privilege('authenticated', fn, 'EXECUTE') then
      raise exception 'Security hardening failed: authenticated cannot execute %', fn;
    end if;
  end loop;
end $$;

commit;
