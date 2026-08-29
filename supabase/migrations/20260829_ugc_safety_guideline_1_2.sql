-- App Store Guideline 1.2 UGC safety layer.
-- Additive only: does not modify LiveKit camera/mic/video transport, gifts, wallet, or guest transport.

-- 1) Terms/EULA acceptance audit trail.
create table if not exists public.droxion_terms_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  platform text,
  primary key (user_id, terms_version)
);

alter table public.droxion_terms_acceptances enable row level security;

revoke all on table public.droxion_terms_acceptances from public;
revoke all on table public.droxion_terms_acceptances from anon;
revoke all on table public.droxion_terms_acceptances from authenticated;

create or replace function public.droxion_record_terms_acceptance(
  p_terms_version text,
  p_platform text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_version text := btrim(coalesce(p_terms_version, ''));
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;
  if v_version = '' or char_length(v_version) > 80 then
    raise exception 'Invalid terms version';
  end if;

  insert into public.droxion_terms_acceptances(user_id, terms_version, accepted_at, platform)
  values (v_user, v_version, now(), nullif(btrim(coalesce(p_platform, '')), ''))
  on conflict (user_id, terms_version)
  do update set accepted_at = excluded.accepted_at,
                platform = coalesce(excluded.platform, public.droxion_terms_acceptances.platform);

  return jsonb_build_object('ok', true, 'terms_version', v_version, 'accepted_at', now());
end;
$$;

revoke all on function public.droxion_record_terms_acceptance(text, text) from public;
revoke all on function public.droxion_record_terms_acceptance(text, text) from anon;
grant execute on function public.droxion_record_terms_acceptance(text, text) to authenticated;

-- 2) Expand the existing reports table so every report has content context and a 24-hour review deadline.
alter table public.droxion_reports
  add column if not exists target_type text not null default 'user',
  add column if not exists target_id text,
  add column if not exists session_id uuid,
  add column if not exists review_due_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution text,
  add column if not exists moderator_note text;

update public.droxion_reports
set review_due_at = created_at + interval '24 hours'
where review_due_at is null;

alter table public.droxion_reports
  alter column review_due_at set default (now() + interval '24 hours'),
  alter column review_due_at set not null;

create index if not exists droxion_reports_open_due_idx
  on public.droxion_reports(status, review_due_at)
  where status in ('submitted', 'reviewing');

create index if not exists droxion_reports_reported_user_idx
  on public.droxion_reports(reported_user_id, created_at desc);

-- 3) Server-side report submission.
create or replace function public.droxion_submit_report(
  p_reported_user_id uuid,
  p_category text,
  p_details text default null,
  p_target_type text default 'user',
  p_target_id text default null,
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_category text := lower(btrim(coalesce(p_category, '')));
  v_target_type text := lower(btrim(coalesce(p_target_type, 'user')));
  v_details text := nullif(left(btrim(coalesce(p_details, '')), 1000), '');
  v_report_id uuid;
  v_due timestamptz;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;
  if p_reported_user_id is null or p_reported_user_id = v_user then
    raise exception 'Invalid reported user';
  end if;

  if v_category not in (
    'sexual_content', 'harassment', 'hate_or_threats', 'violence_or_danger',
    'underage', 'spam_or_scam', 'illegal_activity', 'other', 'blocked_user'
  ) then
    raise exception 'Invalid report category';
  end if;

  if v_target_type not in ('user', 'live', 'clip', 'live_chat', 'clip_comment') then
    raise exception 'Invalid report target';
  end if;

  select id, review_due_at
    into v_report_id, v_due
  from public.droxion_reports
  where reporter_id = v_user
    and reported_user_id = p_reported_user_id
    and category = v_category
    and target_type = v_target_type
    and coalesce(target_id, '') = coalesce(nullif(btrim(coalesce(p_target_id, '')), ''), '')
    and created_at > now() - interval '60 seconds'
  order by created_at desc
  limit 1;

  if v_report_id is not null then
    return jsonb_build_object('ok', true, 'report_id', v_report_id, 'review_due_at', v_due, 'duplicate', true);
  end if;

  insert into public.droxion_reports(
    reporter_id, reported_user_id, category, details, status,
    target_type, target_id, session_id, review_due_at
  ) values (
    v_user,
    p_reported_user_id,
    v_category,
    v_details,
    'submitted',
    v_target_type,
    nullif(btrim(coalesce(p_target_id, '')), ''),
    p_session_id,
    now() + interval '24 hours'
  )
  returning id, review_due_at into v_report_id, v_due;

  return jsonb_build_object('ok', true, 'report_id', v_report_id, 'review_due_at', v_due, 'duplicate', false);
end;
$$;

revoke all on function public.droxion_submit_report(uuid, text, text, text, text, uuid) from public;
revoke all on function public.droxion_submit_report(uuid, text, text, text, text, uuid) from anon;
grant execute on function public.droxion_submit_report(uuid, text, text, text, text, uuid) to authenticated;

-- 4) Blocking is transactional and automatically notifies moderation by creating a report.
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
  if v_user is null then
    raise exception 'Authentication required';
  end if;
  if p_blocked_user_id is null or p_blocked_user_id = v_user then
    raise exception 'Invalid blocked user';
  end if;
  if v_context_type not in ('user', 'live', 'clip', 'live_chat', 'clip_comment') then
    v_context_type := 'user';
  end if;

  insert into public.droxion_blocks(blocker_id, blocked_user_id, created_at)
  values (v_user, p_blocked_user_id, now())
  on conflict (blocker_id, blocked_user_id) do nothing;

  select id into v_report_id
  from public.droxion_reports
  where reporter_id = v_user
    and reported_user_id = p_blocked_user_id
    and category = 'blocked_user'
    and status in ('submitted', 'reviewing')
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
    )
    returning id into v_report_id;
  end if;

  return jsonb_build_object('ok', true, 'blocked_user_id', p_blocked_user_id, 'report_id', v_report_id);
end;
$$;

revoke all on function public.droxion_block_user(uuid, text, text, uuid) from public;
revoke all on function public.droxion_block_user(uuid, text, text, uuid) from anon;
grant execute on function public.droxion_block_user(uuid, text, text, uuid) to authenticated;

-- 5) Extend objectionable-text filtering to highlight comments without changing LIVE media transport.
create or replace function public.droxion_reject_objectionable_clip_comment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_lower text := lower(coalesce(new.body, ''));
begin
  if v_lower ~ '(kill yourself|go kill yourself|kys|n[i1]gg[e3]r|f[a@]gg[o0]t|rape you|child porn|cp link)' then
    raise exception 'Objectionable content is not allowed.';
  end if;
  return new;
end;
$$;

drop trigger if exists droxion_clip_comment_objectionable_filter on public.droxion_clip_comments;
create trigger droxion_clip_comment_objectionable_filter
before insert or update of body on public.droxion_clip_comments
for each row execute function public.droxion_reject_objectionable_clip_comment();

-- 6) Service-role moderation queue and enforcement tools for the 24-hour process.
create table if not exists public.droxion_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.droxion_reports(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.droxion_moderation_actions enable row level security;
revoke all on table public.droxion_moderation_actions from public;
revoke all on table public.droxion_moderation_actions from anon;
revoke all on table public.droxion_moderation_actions from authenticated;
grant select, insert on table public.droxion_moderation_actions to service_role;

create or replace view public.droxion_moderation_queue as
select
  r.id,
  r.reporter_id,
  r.reported_user_id,
  p.display_name as reported_display_name,
  p.username as reported_username,
  r.category,
  r.details,
  r.target_type,
  r.target_id,
  r.session_id,
  r.status,
  r.created_at,
  r.review_due_at,
  (r.review_due_at < now()) as overdue,
  r.resolved_at,
  r.resolution,
  r.moderator_note
from public.droxion_reports r
left join public.droxion_profiles p on p.user_id = r.reported_user_id
where r.status in ('submitted', 'reviewing')
order by r.review_due_at asc, r.created_at asc;

revoke all on public.droxion_moderation_queue from public;
revoke all on public.droxion_moderation_queue from anon;
revoke all on public.droxion_moderation_queue from authenticated;
grant select on public.droxion_moderation_queue to service_role;

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

  if not found then
    raise exception 'Report not found';
  end if;

  if v_action <> 'dismiss' then
    if v_report.target_type = 'clip' and v_report.target_id is not null then
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

    update public.droxion_live_presence
    set is_live = false, last_seen_at = now()
    where user_id = v_report.reported_user_id;
  elsif v_action = 'ban_user' and v_report.reported_user_id is not null then
    update auth.users
    set banned_until = 'infinity'::timestamptz
    where id = v_report.reported_user_id;

    update public.droxion_live_presence
    set is_live = false, last_seen_at = now()
    where user_id = v_report.reported_user_id;
  end if;

  update public.droxion_reports
  set status = case when v_action = 'dismiss' then 'dismissed' else 'resolved' end,
      resolved_at = now(),
      resolution = v_action,
      moderator_note = v_note
  where id = p_report_id;

  insert into public.droxion_moderation_actions(report_id, reported_user_id, action, note)
  values (p_report_id, v_report.reported_user_id, v_action, v_note);

  return jsonb_build_object('ok', true, 'report_id', p_report_id, 'action', v_action, 'resolved_at', now());
end;
$$;

revoke all on function public.droxion_moderation_enforce(uuid, text, text) from public;
revoke all on function public.droxion_moderation_enforce(uuid, text, text) from anon;
revoke all on function public.droxion_moderation_enforce(uuid, text, text) from authenticated;
grant execute on function public.droxion_moderation_enforce(uuid, text, text) to service_role;
