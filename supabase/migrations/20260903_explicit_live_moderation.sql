-- Creator-side explicit-content enforcement. This table is intentionally not
-- directly readable/writable by clients; authenticated creators can only mark
-- their own currently active LIVE through the SECURITY DEFINER function below.

create table if not exists public.droxion_live_moderation_blocks (
  session_id uuid primary key,
  creator_id uuid not null,
  reason text not null default 'explicit_nudity',
  confidence numeric not null default 0,
  blocked_at timestamptz not null default now()
);

alter table public.droxion_live_moderation_blocks enable row level security;
revoke all on public.droxion_live_moderation_blocks from anon, authenticated;

create index if not exists droxion_live_moderation_blocks_creator_idx
on public.droxion_live_moderation_blocks (creator_id, blocked_at desc);

create or replace function public.droxion_block_my_live_for_explicit_content(
  p_session_id uuid,
  p_confidence numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_user uuid := auth.uid();
  v_presence public.droxion_live_presence%rowtype;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if p_session_id is null then raise exception 'LIVE session is required.'; end if;

  select * into v_presence
  from public.droxion_live_presence
  where user_id = v_user
    and session_id = p_session_id
  for update;

  if not found then
    return jsonb_build_object('blocked', false, 'reason', 'session_not_owned');
  end if;

  insert into public.droxion_live_moderation_blocks (
    session_id, creator_id, reason, confidence, blocked_at
  ) values (
    p_session_id, v_user, 'explicit_nudity', greatest(0, least(coalesce(p_confidence, 0), 1)), now()
  )
  on conflict (session_id) do update
    set confidence = greatest(public.droxion_live_moderation_blocks.confidence, excluded.confidence),
        blocked_at = least(public.droxion_live_moderation_blocks.blocked_at, excluded.blocked_at);

  update public.droxion_live_presence
     set is_live = false,
         ended_at = coalesce(ended_at, now()),
         updated_at = now()
   where user_id = v_user
     and session_id = p_session_id;

  delete from public.droxion_live_viewers where session_id = p_session_id;

  return jsonb_build_object(
    'blocked', true,
    'reason', 'explicit_nudity',
    'session_id', p_session_id
  );
end;
$function$;

revoke all on function public.droxion_block_my_live_for_explicit_content(uuid,numeric) from public;
grant execute on function public.droxion_block_my_live_for_explicit_content(uuid,numeric) to authenticated;

-- Keep automatic shorts from explicit-content LIVEs out of the feed even if a
-- recorder finishes after the LIVE has already been terminated.
create or replace function public.droxion_publish_live_clip_v2(
  p_session_id uuid,
  p_storage_path text,
  p_caption text,
  p_duration_seconds integer,
  p_highlight_score numeric,
  p_source_start_ms bigint,
  p_source_end_ms bigint,
  p_camera_facing text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'storage', 'auth'
as $function$
declare
  v_user uuid := auth.uid();
  v_count integer;
  v_clip_id uuid;
  v_video_url text;
  v_path text := btrim(coalesce(p_storage_path, ''));
  v_caption text := left(btrim(coalesce(p_caption, '')), 220);
  v_camera_facing text := lower(btrim(coalesce(p_camera_facing, 'user')));
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_session_id is null then raise exception 'LIVE session is required'; end if;
  if p_duration_seconds is null or p_duration_seconds < 8 or p_duration_seconds > 45 then
    raise exception 'Highlight duration must be 8 to 45 seconds';
  end if;
  if v_camera_facing not in ('user','environment') then v_camera_facing := 'user'; end if;
  if v_path = '' or position('..' in v_path) > 0 then raise exception 'Invalid clip path'; end if;
  if v_path not like v_user::text || '/' || p_session_id::text || '/%' then
    raise exception 'Clip path does not belong to this creator and LIVE';
  end if;
  if not exists (
    select 1 from public.droxion_live_presence lp
    where lp.session_id = p_session_id and lp.user_id = v_user
  ) then
    raise exception 'Only the LIVE creator can publish this highlight';
  end if;
  if exists (
    select 1 from public.droxion_live_moderation_blocks b
    where b.session_id = p_session_id and b.creator_id = v_user
  ) then
    raise exception 'Automatic highlight blocked by LIVE moderation';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'droxion-live-clips' and o.name = v_path
  ) then
    raise exception 'Uploaded clip file was not found';
  end if;

  select count(*) into v_count
  from public.droxion_live_clips c
  where c.session_id = p_session_id and c.creator_id = v_user and c.clip_type = 'auto';
  if v_count >= 1 then raise exception 'This LIVE already has its automatic highlight'; end if;

  v_video_url := 'https://zlnhaqzawbzagraxhmlb.supabase.co/storage/v1/object/public/droxion-live-clips/' || v_path;

  insert into public.droxion_live_clips (
    creator_id, session_id, video_url, storage_path, caption, duration_seconds,
    source_start_ms, source_end_ms, highlight_score, status, published_at, clip_type, camera_facing
  ) values (
    v_user, p_session_id, v_video_url, v_path,
    nullif(v_caption,''), p_duration_seconds,
    greatest(coalesce(p_source_start_ms,0),0),
    greatest(coalesce(p_source_end_ms,0),0),
    greatest(coalesce(p_highlight_score,0),0),
    'ready', now(), 'auto', v_camera_facing
  )
  returning id into v_clip_id;

  return jsonb_build_object('id', v_clip_id, 'video_url', v_video_url, 'status', 'ready', 'camera_facing', v_camera_facing);
end;
$function$;

revoke all on function public.droxion_publish_live_clip_v2(uuid,text,text,integer,numeric,bigint,bigint,text) from public;
grant execute on function public.droxion_publish_live_clip_v2(uuid,text,text,integer,numeric,bigint,bigint,text) to authenticated;
