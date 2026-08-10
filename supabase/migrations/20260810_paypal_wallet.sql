-- Hardened PayPal wallet migration for Droxion
-- Review before running in Supabase SQL Editor.
-- Designed to make PayPal fulfillment atomic and idempotent.

begin;

create extension if not exists pgcrypto;

create table if not exists public.droxion_paypal_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  package_id text not null,
  paypal_order_id text not null,
  paypal_capture_id text,
  amount numeric(10,2) not null,
  currency text not null default 'USD',
  coins integer not null,
  payment_status text not null default 'pending',
  fulfilled boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (paypal_order_id),
  unique (paypal_capture_id),
  check (amount > 0),
  check (coins > 0)
);

-- This table must not be directly writable from the browser.
alter table public.droxion_paypal_transactions enable row level security;

revoke all privileges
on table public.droxion_paypal_transactions
from public, anon, authenticated;

-- The trusted server-side Supabase client uses service_role.
grant select, insert, update
on table public.droxion_paypal_transactions
to service_role;

create index if not exists droxion_paypal_transactions_user_created_idx
  on public.droxion_paypal_transactions (user_id, created_at desc);

create index if not exists droxion_paypal_transactions_status_idx
  on public.droxion_paypal_transactions (payment_status, fulfilled);

-- A wallet must be one row per user before we can safely use ON CONFLICT.
-- If duplicates already exist, stop the migration instead of guessing which
-- balance is correct.
do $$
begin
  if exists (
    select 1
    from public.droxion_wallets
    group by user_id
    having count(*) > 1
  ) then
    raise exception
      'PayPal migration stopped: duplicate rows exist in public.droxion_wallets for at least one user_id. Resolve wallet duplicates before enabling live payments.';
  end if;
end;
$$;

-- Guarantees one wallet row per user. If the table already has an equivalent
-- primary/unique constraint, this extra unique index is harmless.
create unique index if not exists droxion_wallets_user_id_paypal_uidx
  on public.droxion_wallets (user_id);

create or replace function public.droxion_fulfill_paypal_purchase(
  p_user_id uuid,
  p_paypal_order_id text,
  p_paypal_capture_id text,
  p_package_id text,
  p_amount numeric,
  p_currency text,
  p_coins integer,
  p_status text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing_record public.droxion_paypal_transactions%rowtype;
  v_capture_id text := nullif(btrim(p_paypal_capture_id), '');
  v_order_id text := nullif(btrim(p_paypal_order_id), '');
  v_package_id text := nullif(btrim(p_package_id), '');
  v_currency text := upper(nullif(btrim(p_currency), ''));
  v_status text := upper(nullif(btrim(p_status), ''));
  v_rows integer;
begin
  -- Never fulfill an uncertain or non-completed payment.
  if v_status is distinct from 'COMPLETED' then
    raise exception 'PayPal purchase cannot be fulfilled unless status is COMPLETED.';
  end if;

  if v_order_id is null then
    raise exception 'PayPal order ID is required.';
  end if;

  if v_capture_id is null then
    raise exception 'PayPal capture ID is required.';
  end if;

  if v_package_id is null then
    raise exception 'Package ID is required.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Captured amount must be greater than zero.';
  end if;

  if p_coins is null or p_coins <= 0 then
    raise exception 'Coin amount must be greater than zero.';
  end if;

  if v_currency is distinct from 'USD' then
    raise exception 'Only USD PayPal purchases can be fulfilled.';
  end if;

  -- Lock the pending purchase row. A second capture/webhook request for the
  -- same order must wait until this transaction finishes, preventing a
  -- double-credit race.
  select *
    into existing_record
  from public.droxion_paypal_transactions
  where paypal_order_id = v_order_id
  for update;

  if not found then
    raise exception 'No pending purchase was found for the provided PayPal order.';
  end if;

  -- Validate the immutable server-side purchase contract.
  if existing_record.user_id <> p_user_id then
    raise exception 'This purchase does not belong to the authenticated user.';
  end if;

  if existing_record.package_id <> v_package_id then
    raise exception 'The PayPal package does not match the pending purchase.';
  end if;

  if existing_record.amount <> p_amount then
    raise exception 'The captured amount does not match the pending purchase.';
  end if;

  if upper(existing_record.currency) <> v_currency then
    raise exception 'The captured currency does not match the pending purchase.';
  end if;

  if existing_record.coins <> p_coins then
    raise exception 'The coins awarded do not match the pending purchase.';
  end if;

  if existing_record.paypal_capture_id is not null
     and existing_record.paypal_capture_id <> v_capture_id then
    raise exception 'A different PayPal capture ID was already recorded for this order.';
  end if;

  -- Idempotent retry: if this exact completed purchase was already fulfilled,
  -- return success without adding coins again.
  if existing_record.fulfilled then
    if upper(existing_record.payment_status) = 'COMPLETED'
       and existing_record.paypal_capture_id = v_capture_id then
      return jsonb_build_object(
        'id', existing_record.id,
        'already_completed', true,
        'coins', existing_record.coins
      );
    end if;

    raise exception 'This PayPal order was already fulfilled in an unexpected state.';
  end if;

  -- Ensure a wallet exists. The unique index above makes this race-safe.
  insert into public.droxion_wallets (
    user_id,
    coin_balance,
    free_matches_remaining,
    plan
  )
  values (
    p_user_id,
    0,
    0,
    'free'
  )
  on conflict (user_id) do nothing;

  -- Record completion first inside the same database transaction.
  -- The UNIQUE paypal_capture_id constraint protects against reusing one
  -- capture for a different order.
  update public.droxion_paypal_transactions
  set paypal_capture_id = v_capture_id,
      payment_status = 'COMPLETED',
      fulfilled = true,
      completed_at = coalesce(completed_at, now())
  where id = existing_record.id
    and fulfilled = false;

  get diagnostics v_rows = row_count;

  if v_rows <> 1 then
    raise exception 'PayPal fulfillment state changed unexpectedly; coins were not credited.';
  end if;

  -- Atomic increment. If this update fails, PostgreSQL rolls back the
  -- transaction update above as well.
  update public.droxion_wallets
  set coin_balance = coalesce(coin_balance, 0) + p_coins,
      updated_at = now()
  where user_id = p_user_id;

  get diagnostics v_rows = row_count;

  if v_rows <> 1 then
    raise exception 'Wallet update failed or wallet integrity is invalid; PayPal fulfillment was rolled back.';
  end if;

  return jsonb_build_object(
    'id', existing_record.id,
    'already_completed', false,
    'coins', p_coins
  );
end;
$$;

-- PostgreSQL functions are executable by PUBLIC by default unless revoked.
revoke execute on function public.droxion_fulfill_paypal_purchase(
  uuid, text, text, text, numeric, text, integer, text
) from public;

revoke execute on function public.droxion_fulfill_paypal_purchase(
  uuid, text, text, text, numeric, text, integer, text
) from anon, authenticated;

grant execute on function public.droxion_fulfill_paypal_purchase(
  uuid, text, text, text, numeric, text, integer, text
) to service_role;

commit;
