-- Droxion product rule: creators may publish up to five automatic LIVE
-- highlights per UTC day. Native LIVE transport/recording is unchanged; this
-- migration only changes the publication guard for the Reel feed.

-- The previous policy allowed only one automatic highlight per LIVE.
drop index if exists public.droxion_live_clips_one_auto_per_live;

-- Keep retries/idempotency safe after allowing multiple clips from one LIVE.
create unique index if not exists droxion_live_clips_auto_segment_unique
on public.droxion_live_clips (
  session_id,
  creator_id,
  source_start_ms,
  source_end_ms
)
where clip_type = 'auto';

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
  v_day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
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
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'droxion-live-clips' and o.name = v_path
  ) then
    raise exception 'Uploaded clip file was not found';
  end if;

  -- Serialize a creator's auto-clip publications for this UTC day so two LIVE
  -- sessions ending together cannot race past the five-clip cap.
  perform pg_advisory_xact_lock(
    hashtextextended(v_user::text || ':' || v_day_start::date::text, 0)
  );

  select count(*) into v_count
  from public.droxion_live_clips c
  where c.creator_id = v_user
    and c.clip_type = 'auto'
    and c.published_at >= v_day_start
    and c.published_at < v_day_start + interval '1 day';

  if v_count >= 5 then
    raise exception 'Daily automatic highlight limit reached';
  end if;

  v_video_url := 'https://zlnhaqzawbzagraxhmlb.supabase.co/storage/v1/object/public/droxion-live-clips/' || v_path;

  insert into public.droxion_live_clips (
    creator_id, session_id, video_url, storage_path, caption, duration_seconds,
    source_start_ms, source_end_ms, highlight_score, status, published_at,
    clip_type, camera_facing
  ) values (
    v_user, p_session_id, v_video_url, v_path,
    nullif(v_caption,''), p_duration_seconds,
    greatest(coalesce(p_source_start_ms,0),0),
    greatest(coalesce(p_source_end_ms,0),0),
    greatest(coalesce(p_highlight_score,0),0),
    'ready', now(), 'auto', v_camera_facing
  )
  returning id into v_clip_id;

  return jsonb_build_object(
    'id', v_clip_id,
    'video_url', v_video_url,
    'status', 'ready',
    'camera_facing', v_camera_facing,
    'daily_auto_count', v_count + 1,
    'daily_auto_limit', 5
  );
end;
$function$;

revoke all on function public.droxion_publish_live_clip_v2(uuid,text,text,integer,numeric,bigint,bigint,text) from public;
grant execute on function public.droxion_publish_live_clip_v2(uuid,text,text,integer,numeric,bigint,bigint,text) to authenticated;
