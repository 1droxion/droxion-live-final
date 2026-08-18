-- Server-only payout state transitions: never callable by app clients.
revoke all on function public.droxion_finalize_payout(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.droxion_finalize_payout(uuid, boolean, text, text) to service_role;

revoke all on function public.droxion_mark_payout_processing(uuid, text) from public, anon, authenticated;
grant execute on function public.droxion_mark_payout_processing(uuid, text) to service_role;

-- Trigger/helper functions are invoked by PostgreSQL triggers, not by app clients.
revoke execute on function public.create_droxion_profile_for_new_user() from public, anon, authenticated;
revoke execute on function public.create_droxion_wallet_for_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_droxion_user() from public, anon, authenticated;
revoke execute on function public.set_droxion_wallet_updated_at() from public, anon, authenticated;

-- Private user RPCs require an authenticated session. Public LIVE discovery remains unchanged.
revoke execute on function public.consume_random_match() from public, anon;
grant execute on function public.consume_random_match() to authenticated;

revoke execute on function public.droxion_connection_history() from public, anon;
grant execute on function public.droxion_connection_history() to authenticated;

revoke execute on function public.droxion_current_live_context() from public, anon;
grant execute on function public.droxion_current_live_context() to authenticated;

revoke execute on function public.droxion_direct_call_status(uuid) from public, anon;
grant execute on function public.droxion_direct_call_status(uuid) to authenticated;

revoke execute on function public.droxion_extend_call() from public, anon;
grant execute on function public.droxion_extend_call() to authenticated;

revoke execute on function public.droxion_incoming_direct_call() from public, anon;
grant execute on function public.droxion_incoming_direct_call() to authenticated;

revoke execute on function public.droxion_mark_conversation_read(uuid) from public, anon;
grant execute on function public.droxion_mark_conversation_read(uuid) to authenticated;

revoke execute on function public.droxion_request_connection(uuid) from public, anon;
grant execute on function public.droxion_request_connection(uuid) to authenticated;

revoke execute on function public.droxion_respond_connection(uuid, boolean) from public, anon;
grant execute on function public.droxion_respond_connection(uuid, boolean) to authenticated;

revoke execute on function public.droxion_respond_direct_call(uuid, boolean) from public, anon;
grant execute on function public.droxion_respond_direct_call(uuid, boolean) to authenticated;

revoke execute on function public.droxion_start_direct_call(uuid) from public, anon;
grant execute on function public.droxion_start_direct_call(uuid) to authenticated;

revoke execute on function public.droxion_use_match() from public, anon;
grant execute on function public.droxion_use_match() to authenticated;
