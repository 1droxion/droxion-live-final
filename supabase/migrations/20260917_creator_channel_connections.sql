create table if not exists public.creator_channel_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('youtube', 'instagram', 'tiktok', 'facebook')),
  provider_account_id text not null,
  display_name text,
  handle text,
  avatar_url text,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, provider)
);

create index if not exists creator_channel_connections_user_provider_idx
  on public.creator_channel_connections (user_id, provider);

alter table public.creator_channel_connections enable row level security;

revoke all on table public.creator_channel_connections from anon, authenticated;
grant select, insert, update, delete on table public.creator_channel_connections to service_role;

comment on table public.creator_channel_connections is
  'Server-only encrypted creator OAuth connections used by Droxion Creator Autopilot.';

comment on column public.creator_channel_connections.access_token_ciphertext is
  'AES-256-GCM encrypted provider access token. Never expose through browser clients.';

comment on column public.creator_channel_connections.refresh_token_ciphertext is
  'AES-256-GCM encrypted provider refresh token. Never expose through browser clients.';
