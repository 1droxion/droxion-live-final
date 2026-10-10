-- Run in the SQL editor of a NEW Supabase project; add the first admin manually.
create table if not exists public.shorts_admins(user_id uuid primary key references auth.users(id) on delete cascade);
create table if not exists public.shorts_series(id text primary key,title text not null,genre text not null,language text not null default 'English',synopsis text not null default '',poster_url text,free_episodes integer not null check(free_episodes between 1 and 100),published boolean not null default false,created_at timestamptz not null default now());
create table if not exists public.shorts_episodes(id uuid primary key default gen_random_uuid(),series_id text not null references public.shorts_series(id) on delete cascade,number integer not null check(number>0),title text not null,storage_path text not null unique,unique(series_id,number));
create table if not exists public.shorts_access(user_id uuid primary key references auth.users(id) on delete cascade,expires_at timestamptz not null,source text not null default 'manual');
alter table public.shorts_admins enable row level security;
alter table public.shorts_series enable row level security;
alter table public.shorts_episodes enable row level security;
alter table public.shorts_access enable row level security;
create or replace function public.shorts_is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from shorts_admins where user_id=auth.uid())$$;
revoke all on function public.shorts_is_admin() from public;
grant execute on function public.shorts_is_admin() to anon,authenticated;
create policy admin_self on public.shorts_admins for select to authenticated using(user_id=auth.uid());
create policy series_read on public.shorts_series for select to anon,authenticated using(published or shorts_is_admin());
create policy episodes_read on public.shorts_episodes for select to anon,authenticated using(exists(select 1 from shorts_series s where s.id=series_id and (s.published or shorts_is_admin())));
create policy access_self on public.shorts_access for select to authenticated using(user_id=auth.uid());
revoke all on public.shorts_admins,public.shorts_series,public.shorts_episodes,public.shorts_access from anon,authenticated;
grant select on public.shorts_series to anon,authenticated;
grant select(id,series_id,number,title) on public.shorts_episodes to anon,authenticated;
grant select on public.shorts_admins,public.shorts_access to authenticated;
create or replace function public.shorts_can_watch(path text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from shorts_episodes e join shorts_series s on s.id=e.series_id where e.storage_path=path and (shorts_is_admin() or (s.published and (e.number<=s.free_episodes or exists(select 1 from shorts_access a where a.user_id=auth.uid() and a.expires_at>now())))))
$$;
revoke all on function public.shorts_can_watch(text) from public;
grant execute on function public.shorts_can_watch(text) to anon,authenticated;
create or replace function public.shorts_video_path(episode_id uuid) returns text language sql stable security definer set search_path=public as $$ select storage_path from shorts_episodes where id=episode_id and shorts_can_watch(storage_path) $$;
revoke all on function public.shorts_video_path(uuid) from public;
grant execute on function public.shorts_video_path(uuid) to anon,authenticated;
create or replace function public.shorts_publish(series_data jsonb) returns void language plpgsql security definer set search_path=public as $$
declare sid text:=series_data->>'id'; ep jsonb; expected integer:=1; free_count integer:=(series_data->>'free_episodes')::integer;
begin
 if not shorts_is_admin() then raise exception 'Admin access required';end if;
 if sid is null or sid !~ '^[a-z0-9-]{1,80}$' or coalesce(length(trim(series_data->>'title')),0) not between 1 and 150 then raise exception 'Invalid series';end if;
 if series_data->>'genre' not in ('Romance','Thriller','Mystery','Family') then raise exception 'Invalid genre';end if;
 if jsonb_typeof(series_data->'episodes')<>'array' or jsonb_array_length(series_data->'episodes') not between 1 and 500 or free_count not between 1 and 100 or free_count>jsonb_array_length(series_data->'episodes') then raise exception 'Invalid episodes';end if;
 if exists(select 1 from shorts_series where id=sid) then raise exception 'Series ID already exists. Use a new ID.';end if;
 insert into shorts_series(id,title,genre,language,synopsis,poster_url,free_episodes,published) values(sid,trim(series_data->>'title'),series_data->>'genre',coalesce(series_data->>'language','English'),coalesce(series_data->>'synopsis',''),series_data->>'poster_url',free_count,true);
 for ep in select * from jsonb_array_elements(series_data->'episodes') loop
 if (ep->>'number')::integer<>expected or coalesce(length(ep->>'title'),0)=0 or left(ep->>'storage_path',length(sid)+1)<>sid||'/' or position('..' in ep->>'storage_path')>0 then raise exception 'Invalid episode order or path';end if;
 if not exists(select 1 from storage.objects where bucket_id='shorts-videos' and name=ep->>'storage_path') then raise exception 'Upload all episode files first';end if;
 insert into shorts_episodes(series_id,number,title,storage_path) values(sid,expected,ep->>'title',ep->>'storage_path');expected:=expected+1;
 end loop;
end $$;
revoke all on function public.shorts_publish(jsonb) from public;
grant execute on function public.shorts_publish(jsonb) to authenticated;
insert into storage.buckets(id,name,public,allowed_mime_types) values('shorts-videos','shorts-videos',false,array['video/mp4']) on conflict(id) do nothing;
create policy shorts_upload on storage.objects for insert to authenticated with check(bucket_id='shorts-videos' and public.shorts_is_admin());
create policy shorts_play on storage.objects for select to anon,authenticated using(bucket_id='shorts-videos' and public.shorts_can_watch(name));
-- Provision auth user, then run: insert into public.shorts_admins values ('AUTH_USER_UUID');
-- Paid access must be written only by a trusted billing backend after verified payment.
-- Never ship service-role credentials to the app. This schema does NOT implement billing.
