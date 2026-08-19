create index if not exists droxion_live_presence_active_idx on public.droxion_live_presence (is_live, last_seen_at desc, started_at desc);
create index if not exists droxion_live_viewers_session_heartbeat_idx on public.droxion_live_viewers (session_id, heartbeat_at desc);
create index if not exists droxion_live_viewers_viewer_idx on public.droxion_live_viewers (viewer_id, heartbeat_at desc);
create index if not exists droxion_live_chat_sender_idx on public.droxion_live_chat (sender_id, id desc);
create index if not exists droxion_live_signals_sender_idx on public.droxion_live_signals (sender_id, session_id, id);
create index if not exists droxion_live_gifts_gift_code_idx on public.droxion_live_gifts (gift_code);
create index if not exists droxion_follows_followed_idx on public.droxion_follows (followed_id, follower_id);
create index if not exists droxion_direct_messages_recipient_created_idx on public.droxion_direct_messages (recipient_id, created_at desc);
create index if not exists droxion_notifications_actor_created_idx on public.droxion_notifications (actor_id, created_at desc);
