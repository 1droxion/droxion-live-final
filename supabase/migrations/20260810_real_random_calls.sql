begin;

create extension if not exists pgcrypto;

alter table public.droxion_wallets
  add column if not exists welcome_bonus_granted boolean not null default false;

create table if not exists public.droxion_calls (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  user_a_filter text not null check (user_a_filter in ('both','male','female')),
  user_b_filter text not null check (user_b_filter in ('both','male','female')),
  status text not null default 'ringing' check (status in ('ringing','connected','ended')),
  connected_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  user_a_filter_charged boolean not null default false,
  user_b_filter_charged boolean not null default false,
  user_a_billed_ticks integer not null default 0,
  user_b_billed_ticks integer not null default 0,
  check (user_a <> user_b)
);

create table if not exists public.droxion_random_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gender text not null check (gender in ('man','woman','nonbinary','prefer_not_to_say')),
  filter text not null check (filter in ('both','male','female')),
  status text not null default 'waiting' check (status in ('waiting','matched')),
  call_id uuid references public.droxion_calls(id) on delete set null,
  joined_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now()
);

create table if not exists public.droxion_call_signals (
  id bigint generated always as identity primary key,
  call_id uuid not null references public.droxion_calls(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer','answer','ice')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists droxion_random_queue_waiting_idx on public.droxion_random_queue(status, filter, heartbeat_at desc);
create index if not exists droxion_calls_users_idx on public.droxion_calls(user_a, user_b, status);
create index if not exists droxion_call_signals_call_idx on public.droxion_call_signals(call_id, recipient_id, id);

alter table public.droxion_random_queue enable row level security;
alter table public.droxion_calls enable row level security;
alter table public.droxion_call_signals enable row level security;

revoke all on public.droxion_random_queue from public, anon;
revoke all on public.droxion_calls from public, anon;
revoke all on public.droxion_call_signals from public, anon;

grant select, insert, update, delete on public.droxion_random_queue to authenticated;
grant select, insert, update on public.droxion_calls to authenticated;
grant select, insert, delete on public.droxion_call_signals to authenticated;
grant usage, select on sequence public.droxion_call_signals_id_seq to authenticated;

create policy "queue own row" on public.droxion_random_queue for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "call participants read" on public.droxion_calls for select to authenticated using (auth.uid() in (user_a, user_b));
create policy "signals participant read" on public.droxion_call_signals for select to authenticated using (recipient_id = auth.uid() or sender_id = auth.uid());
create policy "signals sender insert" on public.droxion_call_signals for insert to authenticated with check (sender_id = auth.uid() and exists (select 1 from public.droxion_calls c where c.id = call_id and auth.uid() in (c.user_a, c.user_b)));
create policy "signals participant delete" on public.droxion_call_signals for delete to authenticated using (recipient_id = auth.uid() or sender_id = auth.uid());

create or replace function public.droxion_claim_welcome_bonus()
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v_user auth.users%rowtype; v_wallet public.droxion_wallets%rowtype;
begin
  select * into v_user from auth.users where id = auth.uid();
  if v_user.id is null then raise exception 'Authentication required.'; end if;
  if v_user.email_confirmed_at is null then return jsonb_build_object('granted', false, 'reason', 'email_not_verified'); end if;
  insert into public.droxion_wallets(user_id) values (v_user.id) on conflict (user_id) do nothing;
  select * into v_wallet from public.droxion_wallets where user_id = v_user.id for update;
  if v_wallet.welcome_bonus_granted then return jsonb_build_object('granted', false, 'coin_balance', v_wallet.coin_balance); end if;
  update public.droxion_wallets set coin_balance = coin_balance + 50, welcome_bonus_granted = true, updated_at = now() where user_id = v_user.id returning * into v_wallet;
  return jsonb_build_object('granted', true, 'coin_balance', v_wallet.coin_balance);
end; $$;

create or replace function public.droxion_join_random_queue(p_filter text default 'both')
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid(); v_gender text; v_filter text := lower(coalesce(p_filter, 'both'));
  v_match public.droxion_random_queue%rowtype; v_call public.droxion_calls%rowtype;
  v_candidate_gender_ok boolean; v_self_gender_ok boolean;
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  if v_filter not in ('both','male','female') then raise exception 'Invalid filter.'; end if;
  select coalesce(raw_user_meta_data->>'gender','prefer_not_to_say') into v_gender from auth.users where id = v_uid;
  delete from public.droxion_random_queue where heartbeat_at < now() - interval '45 seconds';
  for v_match in select q.* from public.droxion_random_queue q where q.user_id <> v_uid and q.status = 'waiting' order by q.joined_at for update skip locked loop
    v_candidate_gender_ok := v_filter = 'both' or (v_filter = 'male' and v_match.gender = 'man') or (v_filter = 'female' and v_match.gender = 'woman');
    v_self_gender_ok := v_match.filter = 'both' or (v_match.filter = 'male' and v_gender = 'man') or (v_match.filter = 'female' and v_gender = 'woman');
    if v_candidate_gender_ok and v_self_gender_ok then
      insert into public.droxion_calls(user_a,user_b,user_a_filter,user_b_filter) values(v_match.user_id,v_uid,v_match.filter,v_filter) returning * into v_call;
      update public.droxion_random_queue set status='matched', call_id=v_call.id, heartbeat_at=now() where user_id=v_match.user_id;
      insert into public.droxion_random_queue(user_id,gender,filter,status,call_id,joined_at,heartbeat_at) values(v_uid,v_gender,v_filter,'matched',v_call.id,now(),now()) on conflict(user_id) do update set gender=excluded.gender,filter=excluded.filter,status='matched',call_id=v_call.id,heartbeat_at=now();
      return jsonb_build_object('status','matched','call_id',v_call.id,'partner_id',v_match.user_id,'is_initiator',false);
    end if;
  end loop;
  insert into public.droxion_random_queue(user_id,gender,filter,status,call_id,joined_at,heartbeat_at) values(v_uid,v_gender,v_filter,'waiting',null,now(),now()) on conflict(user_id) do update set gender=excluded.gender,filter=excluded.filter,status='waiting',call_id=null,heartbeat_at=now();
  return jsonb_build_object('status','waiting');
end; $$;

create or replace function public.droxion_random_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_q public.droxion_random_queue%rowtype; v_c public.droxion_calls%rowtype;
begin
  update public.droxion_random_queue set heartbeat_at=now() where user_id=auth.uid();
  select * into v_q from public.droxion_random_queue where user_id=auth.uid();
  if v_q.user_id is null then return jsonb_build_object('status','idle'); end if;
  if v_q.status='waiting' then return jsonb_build_object('status','waiting'); end if;
  select * into v_c from public.droxion_calls where id=v_q.call_id;
  return jsonb_build_object('status',v_c.status,'call_id',v_c.id,'partner_id',case when v_c.user_a=auth.uid() then v_c.user_b else v_c.user_a end,'is_initiator',v_c.user_a=auth.uid());
end; $$;

create or replace function public.droxion_partner_profile(p_call_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v_c public.droxion_calls%rowtype; v_partner auth.users%rowtype; v_partner_id uuid;
begin
  select * into v_c from public.droxion_calls where id=p_call_id;
  if v_c.id is null or auth.uid() not in (v_c.user_a,v_c.user_b) then raise exception 'Call not found.'; end if;
  v_partner_id := case when v_c.user_a=auth.uid() then v_c.user_b else v_c.user_a end;
  select * into v_partner from auth.users where id=v_partner_id;
  return jsonb_build_object('id',v_partner.id,'name',coalesce(v_partner.raw_user_meta_data->>'full_name','Droxion user'),'gender',coalesce(v_partner.raw_user_meta_data->>'gender','prefer_not_to_say'),'country',coalesce(v_partner.raw_user_meta_data->>'country',''),'language',coalesce(v_partner.raw_user_meta_data->>'language',''));
end; $$;

create or replace function public.droxion_mark_call_connected(p_call_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_c public.droxion_calls%rowtype; v_wallet public.droxion_wallets%rowtype; v_fee int := 0; v_is_a boolean;
begin
  select * into v_c from public.droxion_calls where id=p_call_id for update;
  if v_c.id is null or auth.uid() not in (v_c.user_a,v_c.user_b) then raise exception 'Call not found.'; end if;
  v_is_a := auth.uid()=v_c.user_a;
  if (v_is_a and v_c.user_a_filter='female' and not v_c.user_a_filter_charged) or (not v_is_a and v_c.user_b_filter='female' and not v_c.user_b_filter_charged) then v_fee := 3; end if;
  select * into v_wallet from public.droxion_wallets where user_id=auth.uid() for update;
  if v_wallet.coin_balance < v_fee then return jsonb_build_object('allowed',false,'required_coins',v_fee,'coin_balance',v_wallet.coin_balance); end if;
  if v_fee > 0 then update public.droxion_wallets set coin_balance=coin_balance-v_fee,updated_at=now() where user_id=auth.uid(); end if;
  update public.droxion_calls set status='connected', connected_at=coalesce(connected_at,now()), user_a_filter_charged=case when v_is_a then true else user_a_filter_charged end, user_b_filter_charged=case when not v_is_a then true else user_b_filter_charged end where id=p_call_id;
  select * into v_wallet from public.droxion_wallets where user_id=auth.uid();
  return jsonb_build_object('allowed',true,'coin_balance',v_wallet.coin_balance,'filter_fee',v_fee);
end; $$;

create or replace function public.droxion_bill_call_tick(p_call_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_c public.droxion_calls%rowtype; v_wallet public.droxion_wallets%rowtype; v_is_a boolean; v_ticks int; v_due int;
begin
  select * into v_c from public.droxion_calls where id=p_call_id for update;
  if v_c.id is null or v_c.status <> 'connected' or auth.uid() not in (v_c.user_a,v_c.user_b) then return jsonb_build_object('allowed',false,'reason','call_not_connected'); end if;
  v_is_a := auth.uid()=v_c.user_a;
  v_ticks := floor(extract(epoch from (now()-v_c.connected_at))/10)::int;
  v_due := greatest(0, v_ticks - case when v_is_a then v_c.user_a_billed_ticks else v_c.user_b_billed_ticks end);
  if v_due=0 then return jsonb_build_object('allowed',true,'charged',0); end if;
  select * into v_wallet from public.droxion_wallets where user_id=auth.uid() for update;
  if v_wallet.coin_balance < v_due*5 then update public.droxion_calls set status='ended',ended_at=now() where id=p_call_id; return jsonb_build_object('allowed',false,'reason','insufficient_coins','required_coins',v_due*5,'coin_balance',v_wallet.coin_balance); end if;
  update public.droxion_wallets set coin_balance=coin_balance-v_due*5,updated_at=now() where user_id=auth.uid();
  update public.droxion_calls set user_a_billed_ticks=case when v_is_a then v_ticks else user_a_billed_ticks end, user_b_billed_ticks=case when not v_is_a then v_ticks else user_b_billed_ticks end where id=p_call_id;
  return jsonb_build_object('allowed',true,'charged',v_due*5,'coin_balance',(select coin_balance from public.droxion_wallets where user_id=auth.uid()));
end; $$;

create or replace function public.droxion_end_call(p_call_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.droxion_calls set status='ended',ended_at=coalesce(ended_at,now()) where id=p_call_id and auth.uid() in(user_a,user_b);
  delete from public.droxion_random_queue where user_id=auth.uid();
end; $$;

revoke all on function public.droxion_claim_welcome_bonus() from public, anon;
revoke all on function public.droxion_join_random_queue(text) from public, anon;
revoke all on function public.droxion_random_status() from public, anon;
revoke all on function public.droxion_partner_profile(uuid) from public, anon;
revoke all on function public.droxion_mark_call_connected(uuid) from public, anon;
revoke all on function public.droxion_bill_call_tick(uuid) from public, anon;
revoke all on function public.droxion_end_call(uuid) from public, anon;
grant execute on function public.droxion_claim_welcome_bonus() to authenticated;
grant execute on function public.droxion_join_random_queue(text) to authenticated;
grant execute on function public.droxion_random_status() to authenticated;
grant execute on function public.droxion_partner_profile(uuid) to authenticated;
grant execute on function public.droxion_mark_call_connected(uuid) to authenticated;
grant execute on function public.droxion_bill_call_tick(uuid) to authenticated;
grant execute on function public.droxion_end_call(uuid) to authenticated;

commit;
