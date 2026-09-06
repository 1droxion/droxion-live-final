create table if not exists public.droxion_creator_platform_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('youtube','twitch','kick')),
  channel_identifier text not null,
  channel_url text,
  display_name text,
  enabled boolean not null default true,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.droxion_creator_platform_connections enable row level security;

drop policy if exists droxion_creator_platform_connections_select_own on public.droxion_creator_platform_connections;
create policy droxion_creator_platform_connections_select_own
  on public.droxion_creator_platform_connections
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists droxion_creator_platform_connections_insert_own on public.droxion_creator_platform_connections;
create policy droxion_creator_platform_connections_insert_own
  on public.droxion_creator_platform_connections
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists droxion_creator_platform_connections_update_own on public.droxion_creator_platform_connections;
create policy droxion_creator_platform_connections_update_own
  on public.droxion_creator_platform_connections
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists droxion_creator_platform_connections_delete_own on public.droxion_creator_platform_connections;
create policy droxion_creator_platform_connections_delete_own
  on public.droxion_creator_platform_connections
  for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists droxion_creator_platform_connections_provider_enabled_idx
  on public.droxion_creator_platform_connections(provider, enabled)
  where enabled = true;
