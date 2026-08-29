-- Allow a viewer to retry joining a LIVE after the invite has already been accepted.
-- The first accept remains the security gate; repeated accepts by the same invitee
-- are treated as idempotent success so camera/transport retries do not fail with
-- invite_unavailable.

create or replace function public.droxion_respond_live_invite(
  p_invite_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_i public.droxion_live_invites%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('allowed', false, 'reason', 'authentication_required');
  end if;

  select * into v_i
  from public.droxion_live_invites
  where id = p_invite_id
    and invitee_id = auth.uid()
  for update;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'invite_unavailable');
  end if;

  if v_i.status = 'accepted' and coalesce(p_accept, false) then
    return jsonb_build_object(
      'allowed', true,
      'accepted', true,
      'session_id', v_i.session_id,
      'host_id', v_i.host_id,
      'invite_id', v_i.id,
      'already_accepted', true
    );
  end if;

  if v_i.status <> 'pending' then
    return jsonb_build_object('allowed', false, 'reason', 'invite_unavailable');
  end if;

  if not exists (
    select 1
    from public.droxion_live_presence lp
    where lp.session_id = v_i.session_id
      and lp.user_id = v_i.host_id
      and lp.is_live is true
      and lp.last_seen_at > now() - interval '180 seconds'
  ) then
    update public.droxion_live_invites
    set status = 'expired', updated_at = now()
    where id = v_i.id;
    return jsonb_build_object('allowed', false, 'reason', 'live_ended');
  end if;

  if exists (
    select 1
    from public.droxion_blocks b
    where (b.blocker_id = v_i.host_id and b.blocked_user_id = auth.uid())
       or (b.blocker_id = auth.uid() and b.blocked_user_id = v_i.host_id)
  ) then
    update public.droxion_live_invites
    set status = 'expired', updated_at = now()
    where id = v_i.id;
    return jsonb_build_object('allowed', false, 'reason', 'blocked');
  end if;

  if not coalesce(p_accept, false) then
    update public.droxion_live_invites
    set status = 'declined', updated_at = now()
    where id = v_i.id;
    return jsonb_build_object(
      'allowed', true,
      'accepted', false,
      'session_id', v_i.session_id,
      'host_id', v_i.host_id
    );
  end if;

  if not exists (
    select 1
    from public.droxion_live_viewers v
    where v.session_id = v_i.session_id
      and v.viewer_id = auth.uid()
      and v.heartbeat_at > now() - interval '150 seconds'
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'viewer_not_active');
  end if;

  if exists (
    select 1
    from public.droxion_live_invites other
    where other.session_id = v_i.session_id
      and other.status = 'accepted'
      and other.id <> v_i.id
  ) then
    update public.droxion_live_invites
    set status = 'expired', updated_at = now()
    where id = v_i.id;
    return jsonb_build_object('allowed', false, 'reason', 'guest_already_joined');
  end if;

  update public.droxion_live_invites
  set status = 'accepted', updated_at = now()
  where id = v_i.id;

  update public.droxion_live_invites
  set status = 'expired', updated_at = now()
  where session_id = v_i.session_id
    and id <> v_i.id
    and status = 'pending';

  return jsonb_build_object(
    'allowed', true,
    'accepted', true,
    'session_id', v_i.session_id,
    'host_id', v_i.host_id,
    'invite_id', v_i.id
  );
end;
$$;

revoke all on function public.droxion_respond_live_invite(uuid, boolean) from public;
revoke all on function public.droxion_respond_live_invite(uuid, boolean) from anon;
grant execute on function public.droxion_respond_live_invite(uuid, boolean) to authenticated;
