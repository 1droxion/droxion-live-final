-- Tighten App Store UGC safety behavior without touching LiveKit media transport.
-- Report: moderation review first, no automatic deletion.
-- Block: instant relationship severing and content suppression across Droxion surfaces.
-- Moderation action: notify the reported creator and allow an explanation/appeal.

-- Allow moderation notices in the existing notification system and attach a report reference.
alter table public.droxion_notifications
  add column if not exists reference_id text;

alter table public.droxion_notifications
  drop constraint if exists droxion_notifications_type_check;

alter table public.droxion_notifications
  add constraint droxion_notifications_type_check
  check (type = any (array[
    'creator_live'::text,
    'follow'::text,
    'message'::text,
    'gift'::text,
    'ranking'::text,
    'payout'::text,
    'highlight'::text,
    'moderation_action'::text
  ]));

-- Reported creators can submit one explanation/appeal per moderation report.
create table if not exists public.droxion_moderation_appeals (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.droxion_reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  explanation text not null,
  status text not null default 'submitted' check (status in ('submitted','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, user_id)
);

alter table public.droxion_moderation_appeals enable row level security;
revoke all on table public.droxion_moderation_appeals from public;
revoke all on table public.droxion_moderation_appeals from anon;
revoke all on table public.droxion_moderation_appeals from authenticated;
grant select, update on table public.droxion_moderation_appeals to service_role;

create or replace function public.droxion_submit_moderation_appeal(
  p_report_id uuid,
  p_explanation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_text text := btrim(coalesce(p_explanation, ''));
  v_report public.droxion_reports%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if char_length(v_text) < 10 or char_length(v_text) > 2000 then
    raise exception 'Explanation must be between 10 and 2000 characters';
  end if;

  select * into v_report
  from public.droxion_reports
  where id = p_report_id
    and reported_user_id = v_user;

  if not found then raise exception 'Moderation case not found'; end if;
  if v_report.status <> 'resolved' then
    raise exception 'This moderation case is not eligible for an explanation yet';
  end if;

  insert into public.droxion_moderation_appeals(report_id, user_id, explanation, status, created_at, updated_at)
  values (p_report_id, v_user, v_text, 'submitted', now(), now())
  on conflict (report_id, user_id)
  do update set explanation = excluded.explanation,
                status = 'submitted',
                updated_at = now();

  return jsonb_build_object('ok', true, 'report_id', p_report_id, 'status', 'submitted');
end;
$$;

revoke all on function public.droxion_submit_moderation_appeal(uuid, text) from public;
revoke all on function public.droxion_submit_moderation_appeal(uuid, text) from anon;
grant execute on function public.droxion_submit_moderation_appeal(uuid, text) to authenticated;

-- Extend notifications RPC to return the moderation report reference.
drop function if exists public.droxion_my_notifications(integer);
create function public.droxion_my_notifications(p_limit integer default 50)
returns table(
  id uuid,
  type text,
  title text,
  body text,
  actor_id uuid,
  actor_name text,
  actor_avatar text,
  session_id uuid,
  reference_id text,
  read_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  select
    n.id,
    n.type,
    n.title,
    n.body,
    n.actor_id,
    coalesce(p.display_name, 'Droxion') as actor_name,
    p.avatar_url as actor_avatar,
    n.session_id,
    n.reference_id,
    n.read_at,
    n.created_at
  from public.droxion_notifications n
  left join public.droxion_profiles p on p.user_id = n.actor_id
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit,50),100));
$$;

revoke all on function public.droxion_my_notifications(integer) from public;
revoke all on function public.droxion_my_notifications(integer) from anon;
grant execute on function public.droxion_my_notifications(integer) to authenticated;

-- Blocking must immediately sever visible relationships/activity and notify moderation.
create or replace function public.droxion_block_user(
  p_blocked_user_id uuid,
  p_context_type text default 'user',
  p_context_id text default null,
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_context_type text := lower(btrim(coalesce(p_context_type, 'user')));
  v_report_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_blocked_user_id is null or p_blocked_user_id = v_user then raise exception 'Invalid blocked user'; end if;
  if v_context_type not in ('user','live','clip','live_chat','clip_comment') then v_context_type := 'user'; end if;

  insert into public.droxion_blocks(blocker_id, blocked_user_id, created_at)
  values (v_user, p_blocked_user_id, now())
  on conflict (blocker_id, blocked_user_id) do nothing;

  -- Remove follow relationships in both directions.
  delete from public.droxion_follows
  where (follower_id = v_user and followed_id = p_blocked_user_id)
     or (follower_id = p_blocked_user_id and followed_id = v_user);

  -- Remove active viewer registration for the blocked creator.
  delete from public.droxion_live_viewers
  where viewer_id = v_user and host_id = p_blocked_user_id;

  -- Remove old activity notifications generated by the blocked user from the blocker's inbox.
  delete from public.droxion_notifications
  where user_id = v_user and actor_id = p_blocked_user_id;

  -- Blocking itself creates a developer/moderation report as Apple requires.
  select id into v_report_id
  from public.droxion_reports
  where reporter_id = v_user
    and reported_user_id = p_blocked_user_id
    and category = 'blocked_user'
    and status in ('submitted','reviewing')
    and created_at > now() - interval '24 hours'
  order by created_at desc
  limit 1;

  if v_report_id is null then
    insert into public.droxion_reports(
      reporter_id, reported_user_id, category, details, status,
      target_type, target_id, session_id, review_due_at
    ) values (
      v_user,
      p_blocked_user_id,
      'blocked_user',
      'User used the Block User safety control. Moderator review requested.',
      'submitted',
      v_context_type,
      nullif(btrim(coalesce(p_context_id, '')), ''),
      p_session_id,
      now() + interval '24 hours'
    ) returning id into v_report_id;
  end if;

  return jsonb_build_object('ok', true, 'blocked_user_id', p_blocked_user_id, 'report_id', v_report_id);
end;
$$;

revoke all on function public.droxion_block_user(uuid, text, text, uuid) from public;
revoke all on function public.droxion_block_user(uuid, text, text, uuid) from anon;
grant execute on function public.droxion_block_user(uuid, text, text, uuid) to authenticated;

-- Add creator notification after a moderator takes action. Reporter identity is never disclosed.
create or replace function public.droxion_moderation_enforce(
  p_report_id uuid,
  p_action text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_report public.droxion_reports%rowtype;
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 2000), '');
  v_title text;
  v_body text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service-role moderation access required';
  end if;

  if v_action not in ('remove_content', 'suspend_user_24h', 'ban_user', 'dismiss') then
    raise exception 'Invalid moderation action';
  end if;

  select * into v_report
  from public.droxion_reports
  where id = p_report_id
  for update;

  if not found then raise exception 'Report not found'; end if;

  if v_action <> 'dismiss' then
    if v_report.target_type = 'clip' and v_report.target_id is not null then
      -- Remove from all user-facing feeds but preserve evidence for moderation/audit.
      update public.droxion_live_clips
      set status = 'hidden', updated_at = now()
      where id = v_report.target_id::uuid;
    elsif v_report.target_type = 'live_chat' and v_report.target_id is not null then
      delete from public.droxion_live_chat where id = v_report.target_id::bigint;
    elsif v_report.target_type = 'clip_comment' and v_report.target_id is not null then
      delete from public.droxion_clip_comments where id = v_report.target_id::bigint;
    elsif v_report.target_type = 'live' then
      update public.droxion_live_presence
      set is_live = false, last_seen_at = now()
      where (v_report.session_id is not null and session_id = v_report.session_id)
         or user_id = v_report.reported_user_id;
    end if;
  end if;

  if v_action = 'suspend_user_24h' and v_report.reported_user_id is not null then
    update auth.users
    set banned_until = greatest(coalesce(banned_until, now()), now() + interval '24 hours')
    where id = v_report.reported_user_id;
    update public.droxion_live_presence set is_live = false, last_seen_at = now() where user_id = v_report.reported_user_id;
  elsif v_action = 'ban_user' and v_report.reported_user_id is not null then
    update auth.users set banned_until = 'infinity'::timestamptz where id = v_report.reported_user_id;
    update public.droxion_live_presence set is_live = false, last_seen_at = now() where user_id = v_report.reported_user_id;
  end if;

  update public.droxion_reports
  set status = case when v_action = 'dismiss' then 'dismissed' else 'resolved' end,
      resolved_at = now(),
      resolution = v_action,
      moderator_note = v_note
  where id = p_report_id;

  insert into public.droxion_moderation_actions(report_id, reported_user_id, action, note)
  values (p_report_id, v_report.reported_user_id, v_action, v_note);

  if v_action <> 'dismiss' and v_report.reported_user_id is not null then
    v_title := case
      when v_action = 'remove_content' then 'Content removed after safety review'
      when v_action = 'suspend_user_24h' then 'Account suspended after safety review'
      when v_action = 'ban_user' then 'Account action after safety review'
      else 'Droxion safety review update'
    end;

    v_body := case
      when v_action = 'remove_content' then 'Droxion removed content after reviewing a safety report. You may submit an explanation or appeal from this notification.'
      when v_action = 'suspend_user_24h' then 'Droxion applied a 24-hour suspension after reviewing a safety report. You may submit an explanation or appeal.'
      when v_action = 'ban_user' then 'Droxion took account-level action after reviewing a safety report.'
      else 'Droxion completed a safety review.'
    end;

    insert into public.droxion_notifications(user_id, actor_id, type, title, body, session_id, reference_id, created_at)
    values (v_report.reported_user_id, null, 'moderation_action', v_title, v_body, v_report.session_id, p_report_id::text, now());
  end if;

  return jsonb_build_object('ok', true, 'report_id', p_report_id, 'action', v_action, 'resolved_at', now());
end;
$$;

revoke all on function public.droxion_moderation_enforce(uuid, text, text) from public;
revoke all on function public.droxion_moderation_enforce(uuid, text, text) from anon;
revoke all on function public.droxion_moderation_enforce(uuid, text, text) from authenticated;
grant execute on function public.droxion_moderation_enforce(uuid, text, text) to service_role;

create or replace view public.droxion_moderation_appeal_queue as
select
  a.id,
  a.report_id,
  a.user_id,
  p.display_name,
  p.username,
  a.explanation,
  a.status,
  a.created_at,
  a.updated_at,
  r.category,
  r.target_type,
  r.target_id,
  r.resolution
from public.droxion_moderation_appeals a
join public.droxion_reports r on r.id = a.report_id
left join public.droxion_profiles p on p.user_id = a.user_id
where a.status in ('submitted','reviewing')
order by a.created_at asc;

revoke all on public.droxion_moderation_appeal_queue from public;
revoke all on public.droxion_moderation_appeal_queue from anon;
revoke all on public.droxion_moderation_appeal_queue from authenticated;
grant select on public.droxion_moderation_appeal_queue to service_role;
