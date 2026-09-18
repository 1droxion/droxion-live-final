do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'droxion_creator_platform_connections'
  ) then
    alter table public.droxion_creator_platform_connections
      drop constraint if exists droxion_creator_platform_connections_provider_check;

    alter table public.droxion_creator_platform_connections
      add constraint droxion_creator_platform_connections_provider_check
      check (provider in ('youtube','twitch','kick','tango'));
  end if;
end $$;
