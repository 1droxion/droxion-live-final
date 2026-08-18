-- Droxion 1.1: require authentication for private/mutating RPCs.
-- Public discovery RPCs such as droxion_live_feed() are intentionally left unchanged.

do $$
declare
  fn regprocedure;
  fn_name text;
  app_functions text[] := array[
    'public.droxion_creator_wallet_status()',
    'public.droxion_send_live_gift(uuid,text)',
    'public.droxion_send_direct_message(uuid,text)',
    'public.droxion_send_live_chat(uuid,text)',
    'public.droxion_start_live(text,text[],text,boolean)',
    'public.droxion_set_live(boolean)',
    'public.droxion_live_heartbeat()',
    'public.droxion_live_viewer_heartbeat(uuid)',
    'public.droxion_join_live(uuid)',
    'public.droxion_leave_live(uuid)',
    'public.droxion_request_live_guest(uuid)',
    'public.droxion_respond_live_join_request(uuid,boolean)',
    'public.droxion_invite_live_guest(uuid,uuid)',
    'public.droxion_respond_live_invite(uuid,boolean)',
    'public.droxion_remove_live_guest(uuid)',
    'public.droxion_send_live_signal(uuid,uuid,text,text,jsonb)',
    'public.droxion_live_signals_for_me(uuid,bigint)',
    'public.droxion_live_join_requests(uuid)',
    'public.droxion_my_live_join_request(uuid)',
    'public.droxion_my_live_invite()',
    'public.droxion_block_user(uuid)',
    'public.droxion_block_current_live()',
    'public.droxion_report_user(uuid,text,text)',
    'public.droxion_report_current_live(text,text)',
    'public.droxion_my_notifications(integer)',
    'public.droxion_mark_notifications_read()',
    'public.droxion_chat_participants()',
    'public.droxion_chat_conversations()',
    'public.droxion_chat_status()',
    'public.droxion_followers()',
    'public.droxion_following()',
    'public.droxion_follow_stats()',
    'public.droxion_get_direct_conversation(uuid,integer)',
    'public.droxion_my_recent_live_gifts(integer)',
    'public.droxion_creator_analytics()',
    'public.droxion_live_creator_summary(uuid)',
    'public.droxion_begin_payout_request(text,bigint)',
    'public.droxion_begin_payout_request_v2(text,bigint,text,text,text,text,text,text)'
  ];
begin
  foreach fn_name in array app_functions loop
    fn := fn_name::regprocedure;
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- Trigger-only helper; never expose it as an RPC.
revoke execute on function public.droxion_notify_followers_live() from public, anon, authenticated;
