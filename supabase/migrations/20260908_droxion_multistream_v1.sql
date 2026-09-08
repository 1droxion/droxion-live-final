create table if not exists public.droxion_multistream_destinations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  label text not null default '',
  rtmp_url text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint droxion_multistream_platform_check check (platform in ('youtube','facebook','twitch','kick','tiktok','custom')),
  constraint droxion_multistream_rtmp_check check (rtmp_url ~* '^rtmps?://'),
  constraint droxion_multistream_unique_platform unique (user_id, platform, label)
);

create table if not exists public.droxion_multistream_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  egress_id text not null,
  room_name text not null,
  destination_count integer not null default 0,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint droxion_multistream_session_status_check check (status in ('starting','active','stopping','stopped','failed'))
);

create unique index if not exists droxion_multistream_one_active_session_per_user
on public.droxion_multistream_sessions(user_id)
where status in ('starting','active','stopping');

alter table public.droxion_multistream_destinations enable row level security;
alter table public.droxion_multistream_sessions enable row level security;

revoke all on table public.droxion_multistream_destinations from public, anon, authenticated;
revoke all on table public.droxion_multistream_sessions from public, anon, authenticated;

grant all on table public.droxion_multistream_destinations to service_role;
grant all on table public.droxion_multistream_sessions to service_role;

comment on table public.droxion_multistream_destinations is 'Private creator RTMP destinations. Read/write only through authenticated server function.';
comment on table public.droxion_multistream_sessions is 'Tracks LiveKit egress sessions used for Droxion multistream fan-out.';
