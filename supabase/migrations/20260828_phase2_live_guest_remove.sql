-- Creator safety control for ending an accepted/pending guest slot.

create or replace function public.droxion_host_remove_live_guest(
  p_session_id uuid,
  p_invitee_id uuid
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

  if not exists (
    select 1
    from public.droxion_live_presence lp
    where lp.session_id = p_session_id
      and lp.user_id = auth.uid()
      and lp.is_live is true
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'not_live_host');
  end if;

  update public.droxion_live_invites
  set status = 'removed', updated_at = now()
  where session_id = p_session_id
    and host_id = auth.uid()
    and invitee_id = p_invitee_id
    and status in ('accepted', 'pending');

  get diagnostics v_changed = row_count;
  return jsonb_build_object('allowed', true, 'removed', v_changed > 0);
end;
$$;

revoke all on function public.droxion_host_remove_live_guest(uuid, uuid) from public;
revoke all on function public.droxion_host_remove_live_guest(uuid, uuid) from anon;
grant execute on function public.droxion_host_remove_live_guest(uuid, uuid) to authenticated;
