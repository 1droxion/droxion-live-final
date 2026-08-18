-- Droxion 1.1 Creator & LIVE update
-- 51/49 live-gift economics, creator analytics, host LIVE summary,
-- and server-side 21+ signup enforcement.

begin;

create index if not exists droxion_live_gifts_recipient_created_idx
  on public.droxion_live_gifts (recipient_id, created_at desc);

create or replace function public.droxion_creator_wallet_status()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_wallet public.droxion_creator_wallets%rowtype;
begin
  if v_user is null then
    raise exception 'Authentication required.';
  end if;

  insert into public.droxion_creator_wallets(user_id)
  values (v_user)
  on conflict (user_id) do nothing;

  select * into v_wallet
  from public.droxion_creator_wallets
  where user_id = v_user;

  return jsonb_build_object(
    'available_coins', v_wallet.available_coins,
    'pending_payout_coins', v_wallet.pending_payout_coins,
    'lifetime_earned_coins', v_wallet.lifetime_earned_coins,
    'lifetime_withdrawn_coins', v_wallet.lifetime_withdrawn_coins,
    'available_cents', v_wallet.available_coins,
    'minimum_payout_coins', 1000,
    'creator_share_percent', 51,
    'platform_share_percent', 49
  );
end;
$$;

create or replace function public.droxion_send_live_gift(
  p_recipient_id uuid,
  p_gift_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_sender uuid := auth.uid();
  v_presence public.droxion_live_presence%rowtype;
  v_wallet public.droxion_wallets%rowtype;
  v_code text := lower(btrim(coalesce(p_gift_code, '')));
  v_name text;
  v_emoji text;
  v_cost integer;
  v_creator integer;
  v_platform integer;
  v_gift_id uuid;
begin
  if v_sender is null then
    raise exception 'Authentication required.';
  end if;

  if p_recipient_id is null or p_recipient_id = v_sender then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_recipient');
  end if;

  if exists(
    select 1 from public.droxion_blocks
    where blocker_id = v_sender and blocked_user_id = p_recipient_id
  ) or exists(
    select 1 from public.droxion_blocks
    where blocker_id = p_recipient_id and blocked_user_id = v_sender
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'blocked');
  end if;

  select * into v_presence
  from public.droxion_live_presence
  where user_id = p_recipient_id
  for update;

  if v_presence.user_id is null
     or v_presence.is_live is false
     or v_presence.last_seen_at is null
     or v_presence.last_seen_at <= now() - interval '45 seconds' then
    return jsonb_build_object('allowed', false, 'reason', 'recipient_not_live');
  end if;

  select gift_name, emoji, cost_coins
    into v_name, v_emoji, v_cost
  from public.droxion_gift_catalog
  where gift_code = v_code and active is true;

  if v_cost is null then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_gift');
  end if;

  insert into public.droxion_wallets(user_id)
  values (v_sender)
  on conflict (user_id) do nothing;

  select * into v_wallet
  from public.droxion_wallets
  where user_id = v_sender
  for update;

  if v_wallet.coin_balance < v_cost then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'insufficient_coins',
      'required_coins', v_cost,
      'coin_balance', v_wallet.coin_balance
    );
  end if;

  -- Creator receives 51% of each gift's virtual value. Because wallets use
  -- whole coins, tiny gifts are rounded to the nearest coin.
  v_creator := round(v_cost * 0.51)::integer;
  v_platform := v_cost - v_creator;

  update public.droxion_wallets
  set coin_balance = coin_balance - v_cost,
      updated_at = now()
  where user_id = v_sender
  returning * into v_wallet;

  insert into public.droxion_creator_wallets(
    user_id, available_coins, lifetime_earned_coins, updated_at
  ) values (
    p_recipient_id, v_creator, v_creator, now()
  )
  on conflict (user_id) do update set
    available_coins = public.droxion_creator_wallets.available_coins + excluded.available_coins,
    lifetime_earned_coins = public.droxion_creator_wallets.lifetime_earned_coins + excluded.lifetime_earned_coins,
    updated_at = now();

  insert into public.droxion_live_gifts(
    session_id, sender_id, recipient_id, gift_code, gift_name, emoji,
    cost_coins, creator_coins, platform_coins
  ) values (
    v_presence.session_id, v_sender, p_recipient_id, v_code, v_name, v_emoji,
    v_cost, v_creator, v_platform
  )
  returning id into v_gift_id;

  insert into public.droxion_wallet_transactions(
    user_id, amount, transaction_type, balance_after, provider,
    provider_transaction_id, metadata
  ) values (
    v_sender, -v_cost, 'live_gift_sent', v_wallet.coin_balance, 'droxion',
    v_gift_id::text,
    jsonb_build_object(
      'recipient_id', p_recipient_id,
      'gift_code', v_code,
      'gift_name', v_name,
      'creator_share_percent', 51,
      'platform_share_percent', 49
    )
  );

  insert into public.droxion_creator_earnings(
    user_id, amount_cents, source, reference_id
  ) values (
    p_recipient_id, v_creator, 'live_gift', v_gift_id::text
  );

  return jsonb_build_object(
    'allowed', true,
    'gift_id', v_gift_id,
    'gift_code', v_code,
    'gift_name', v_name,
    'emoji', v_emoji,
    'cost_coins', v_cost,
    'creator_coins', v_creator,
    'platform_coins', v_platform,
    'creator_share_percent', 51,
    'platform_share_percent', 49,
    'coin_balance', v_wallet.coin_balance
  );
end;
$$;

create or replace function public.droxion_creator_analytics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_lifetime_gifts bigint := 0;
  v_unique_supporters bigint := 0;
  v_last_7d bigint := 0;
  v_last_30d bigint := 0;
  v_top_name text;
  v_top_spend bigint := 0;
  v_top_gifts bigint := 0;
begin
  if v_user is null then
    raise exception 'Authentication required.';
  end if;

  select count(*), count(distinct sender_id),
         coalesce(sum(creator_coins) filter (where created_at >= now() - interval '7 days'), 0),
         coalesce(sum(creator_coins) filter (where created_at >= now() - interval '30 days'), 0)
    into v_lifetime_gifts, v_unique_supporters, v_last_7d, v_last_30d
  from public.droxion_live_gifts
  where recipient_id = v_user;

  select coalesce(nullif(p.display_name, ''), 'Droxion supporter'),
         sum(g.cost_coins),
         count(*)
    into v_top_name, v_top_spend, v_top_gifts
  from public.droxion_live_gifts g
  left join public.droxion_profiles p on p.user_id = g.sender_id
  where g.recipient_id = v_user
  group by g.sender_id, p.display_name
  order by sum(g.cost_coins) desc, count(*) desc
  limit 1;

  return jsonb_build_object(
    'creator_share_percent', 51,
    'platform_share_percent', 49,
    'lifetime_gifts', coalesce(v_lifetime_gifts, 0),
    'unique_supporters', coalesce(v_unique_supporters, 0),
    'last_7d_creator_coins', coalesce(v_last_7d, 0),
    'last_30d_creator_coins', coalesce(v_last_30d, 0),
    'top_supporter_name', v_top_name,
    'top_supporter_spend_coins', coalesce(v_top_spend, 0),
    'top_supporter_gifts', coalesce(v_top_gifts, 0)
  );
end;
$$;

create or replace function public.droxion_live_creator_summary(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_host uuid;
  v_started_at timestamptz;
  v_total_gifts bigint := 0;
  v_unique_supporters bigint := 0;
  v_gift_coins bigint := 0;
  v_creator_coins bigint := 0;
begin
  if v_user is null then
    raise exception 'Authentication required.';
  end if;

  select user_id, started_at
    into v_host, v_started_at
  from public.droxion_live_presence
  where session_id = p_session_id;

  if v_host is null or v_host <> v_user then
    return jsonb_build_object('allowed', false, 'reason', 'not_host');
  end if;

  select count(*), count(distinct sender_id),
         coalesce(sum(cost_coins), 0), coalesce(sum(creator_coins), 0)
    into v_total_gifts, v_unique_supporters, v_gift_coins, v_creator_coins
  from public.droxion_live_gifts
  where session_id = p_session_id and recipient_id = v_user;

  return jsonb_build_object(
    'allowed', true,
    'session_id', p_session_id,
    'started_at', v_started_at,
    'total_gifts', coalesce(v_total_gifts, 0),
    'unique_supporters', coalesce(v_unique_supporters, 0),
    'gift_coins', coalesce(v_gift_coins, 0),
    'creator_coins', coalesce(v_creator_coins, 0),
    'creator_cents', coalesce(v_creator_coins, 0),
    'creator_share_percent', 51,
    'platform_share_percent', 49
  );
end;
$$;

create or replace function public.enforce_droxion_auth_user_21_plus()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_dob date;
  v_raw text;
begin
  v_raw := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'date_of_birth', '')), '');

  if v_raw is null then
    raise exception 'A valid date of birth is required. Droxion is 21+ only.';
  end if;

  begin
    v_dob := v_raw::date;
  exception when others then
    raise exception 'A valid date of birth is required. Droxion is 21+ only.';
  end;

  if v_dob > (current_date - interval '21 years')::date then
    raise exception 'Droxion is available only to users age 21 or older.';
  end if;

  if v_dob < date '1900-01-01' then
    raise exception 'Please enter a valid date of birth.';
  end if;

  return new;
end;
$$;

drop trigger if exists before_auth_user_created_droxion_age on auth.users;
create trigger before_auth_user_created_droxion_age
before insert on auth.users
for each row execute function public.enforce_droxion_auth_user_21_plus();

revoke execute on function public.droxion_creator_analytics() from public, anon;
revoke execute on function public.droxion_live_creator_summary(uuid) from public, anon;
grant execute on function public.droxion_creator_analytics() to authenticated;
grant execute on function public.droxion_live_creator_summary(uuid) to authenticated;

commit;
