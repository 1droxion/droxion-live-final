-- Phase 2: host-driven LIVE guest invitations.
-- Keeps creator media transport unchanged and authorizes guest publishing only
-- after the invited viewer explicitly accepts.

create index if not exists droxion_live_invites_session_status_idx
  on public.droxion_live_invites (session_id, status, updated_at desc);

create index if not exists droxion_live_invites_invitee_status_idx
  on public.droxion_live_invites (invitee_id, status, updated_at desc);

create or replace function public.droxion_host_invite_live_guest(
  p_session_id uuid,
  p_invitee_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_host_id uuid := auth.uid();
  v_existing public.droxion_live_invites%rowtype;
  v_invite_id uuid;
begin
  if v_host_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'authentication_required');
  end if;

  if p_session_id is null or p_invitee_id is null or p_invitee_id = v_host_id then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_guest');
  end if;

  if not exists (
    select 1
    from public.droxion_live_presence lp
    where lp.session_id = p_session_id
      and lp.user_id = v_host_id
      and lp.is_live is true
      and lp.last_seen_at > now() - interval '180 seconds'
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'not_live_host');
  end if;

  if not exists (
    select 1
    from public.droxion_live_viewers v
    where v.session_id = p_session_id
      and v.viewer_id = p_invitee_id
      and v.heartbeat_at > now() - interval '150 seconds'
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'viewer_not_active');
  end if;

  if exists (
    select 1
    from public.droxion_blocks b
    where (b.blocker_id = v_host_id and b.blocked_user_id = p_invitee_id)
       or (b.blocker_id = p_invitee_id and b.blocked_user_id = v_host_id)
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'blocked');
  end if;

  select * into v_existing
  from public.droxion_live_invites i
  where i.session_id = p_session_id
    and i.status = 'accepted'
  order by i.updated_at desc
  limit 1;

  if found then
    if v_existing.invitee_id = p_invitee_id then
      return jsonb_build_object(
        'allowed', true,
        'invite_id', v_existing.id,
        'status', 'accepted',
        'invitee_id', p_invitee_id
      );
    end if;
    return jsonb_build_object('allowed', false, 'reason', 'guest_already_joined');
  end if;

  select * into v_existing
  from public.droxion_live_invites i
  where i.session_id = p_session_id
    and i.invitee_id = p_invitee_id
    and i.status = 'pending'
    and i.request_source = 'host'
  order by i.updated_at desc
  limit 1;

  if found then
    update public.droxion_live_invites
    set updated_at = now()
    where id = v_existing.id;
    return jsonb_build_object(
      'allowed', true,
      'invite_id', v_existing.id,
      'status', 'pending',
      'invitee_id', p_invitee_id
    );
  end if;

  update public.droxion_live_invites
  set status = 'expired', updated_at = now()
  where session_id = p_session_id
    and host_id = v_host_id
    and request_source = 'host'
    and status = 'pending';

  insert into public.droxion_live_invites (
    session_id,
    host_id,
    invitee_id,
    status,
    request_source
  ) values (
    p_session_id,
    v_host_id,
    p_invitee_id,
    'pending',
    'host'
  )
  returning id into v_invite_id;

  return jsonb_build_object(
    'allowed', true,
    'invite_id', v_invite_id,
    'status', 'pending',
    'invitee_id', p_invitee_id
  );
end;
$$;

create or replace function public.droxion_host_live_guest_state(
  p_session_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when auth.uid() is null then jsonb_build_object('allowed', false, 'reason', 'authentication_required')
    when not exists (
      select 1
      from public.droxion_live_presence lp
      where lp.session_id = p_session_id
        and lp.user_id = auth.uid()
        and lp.is_live is true
    ) then jsonb_build_object('allowed', false, 'reason', 'not_live_host')
    else coalesce((
      select jsonb_build_object(
        'allowed', true,
        'invite_id', i.id,
        'session_id', i.session_id,
        'invitee_id', i.invitee_id,
        'status', i.status,
        'display_name', coalesce(nullif(p.display_name, ''), 'Droxion viewer'),
        'username', nullif(p.username, ''),
        'avatar_url', nullif(p.avatar_url, ''),
        'updated_at', i.updated_at
      )
      from public.droxion_live_invites i
      left join public.droxion_profiles p on p.user_id = i.invitee_id
      where i.session_id = p_session_id
        and i.host_id = auth.uid()
        and i.status in ('accepted', 'pending')
      order by case when i.status = 'accepted' then 0 else 1 end, i.updated_at desc
      limit 1
    ), jsonb_build_object('allowed', true, 'status', 'none'))
  end;
$$;

create or replace function public.droxion_my_live_guest_state(
  p_session_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when auth.uid() is null then jsonb_build_object('allowed', false, 'reason', 'authentication_required')
    else coalesce((
      select jsonb_build_object(
        'allowed', true,
        'invite_id', i.id,
        'session_id', i.session_id,
        'host_id', i.host_id,
        'host_name', coalesce(nullif(p.display_name, ''), 'Droxion creator'),
        'status', i.status,
        'updated_at', i.updated_at
      )
      from public.droxion_live_invites i
      left join public.droxion_profiles p on p.user_id = i.host_id
      where i.session_id = p_session_id
        and i.invitee_id = auth.uid()
      order by i.updated_at desc
      limit 1
    ), jsonb_build_object('allowed', true, 'status', 'none'))
  end;
$$;

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

  if not found or v_i.status <> 'pending' then
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

create or replace function public.droxion_leave_live_guest(
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_changed integer := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('allowed', false, 'reason', 'authentication_required');
  end if;

  update public.droxion_live_invites
  set status = 'removed', updated_at = now()
  where session_id = p_session_id
    and invitee_id = auth.uid()
    and status in ('accepted', 'pending');

  get diagnostics v_changed = row_count;
  return jsonb_build_object('allowed', true, 'removed', v_changed > 0);
end;
$$;

revoke all on function public.droxion_host_invite_live_guest(uuid, uuid) from public;
revoke all on function public.droxion_host_invite_live_guest(uuid, uuid) from anon;
grant execute on function public.droxion_host_invite_live_guest(uuid, uuid) to authenticated;

revoke all on function public.droxion_host_live_guest_state(uuid) from public;
revoke all on function public.droxion_host_live_guest_state(uuid) from anon;
grant execute on function public.droxion_host_live_guest_state(uuid) to authenticated;

revoke all on function public.droxion_my_live_guest_state(uuid) from public;
revoke all on function public.droxion_my_live_guest_state(uuid) from anon;
grant execute on function public.droxion_my_live_guest_state(uuid) to authenticated;

revoke all on function public.droxion_respond_live_invite(uuid, boolean) from public;
revoke all on function public.droxion_respond_live_invite(uuid, boolean) from anon;
grant execute on function public.droxion_respond_live_invite(uuid, boolean) to authenticated;

revoke all on function public.droxion_leave_live_guest(uuid) from public;
revoke all on function public.droxion_leave_live_guest(uuid) from anon;
grant execute on function public.droxion_leave_live_guest(uuid) to authenticated;
