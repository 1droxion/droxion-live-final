alter table public.droxion_products add column if not exists google_product_id text;

create unique index if not exists droxion_products_google_product_id_key
on public.droxion_products (google_product_id)
where google_product_id is not null;

create table if not exists public.droxion_google_transactions (
  purchase_token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id text,
  product_id text not null,
  package_id text not null,
  coins integer not null check (coins > 0),
  purchase_state integer,
  consumption_state integer,
  acknowledgement_state integer,
  purchase_time timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.droxion_google_transactions enable row level security;
revoke all on table public.droxion_google_transactions from anon, authenticated;
grant all on table public.droxion_google_transactions to service_role;

create index if not exists droxion_google_transactions_user_id_idx
on public.droxion_google_transactions (user_id, created_at desc);

create or replace function public.droxion_fulfill_google_purchase(
  p_user_id uuid,
  p_purchase_token text,
  p_order_id text,
  p_product_id text,
  p_package_id text,
  p_coins integer,
  p_purchase_state integer,
  p_consumption_state integer,
  p_acknowledgement_state integer,
  p_purchase_time timestamptz,
  p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.droxion_google_transactions%rowtype;
  v_balance bigint;
begin
  if p_user_id is null then raise exception 'User is required.'; end if;
  if nullif(btrim(p_purchase_token),'') is null then raise exception 'Purchase token is required.'; end if;
  if nullif(btrim(p_product_id),'') is null then raise exception 'Product ID is required.'; end if;
  if nullif(btrim(p_package_id),'') is null then raise exception 'Package ID is required.'; end if;
  if p_coins is null or p_coins <= 0 then raise exception 'Coin amount must be greater than zero.'; end if;

  select * into v_existing
  from public.droxion_google_transactions
  where purchase_token = btrim(p_purchase_token)
  for update;

  if found then
    if v_existing.user_id <> p_user_id then
      raise exception 'This Google Play purchase already belongs to another account.';
    end if;
    select coin_balance into v_balance from public.droxion_wallets where user_id = p_user_id;
    return jsonb_build_object('ok', true, 'already_completed', true, 'coins', v_existing.coins, 'coin_balance', coalesce(v_balance, 0));
  end if;

  insert into public.droxion_wallets(user_id, coin_balance, free_matches_remaining, plan)
  values(p_user_id, 0, 2, 'free')
  on conflict(user_id) do nothing;

  update public.droxion_wallets
  set coin_balance = coin_balance + p_coins,
      updated_at = now()
  where user_id = p_user_id
  returning coin_balance into v_balance;

  insert into public.droxion_google_transactions(
    purchase_token, user_id, order_id, product_id, package_id, coins,
    purchase_state, consumption_state, acknowledgement_state, purchase_time, raw_payload
  ) values (
    btrim(p_purchase_token), p_user_id, nullif(btrim(coalesce(p_order_id,'')),''), btrim(p_product_id), btrim(p_package_id), p_coins,
    p_purchase_state, p_consumption_state, p_acknowledgement_state, p_purchase_time, coalesce(p_raw_payload,'{}'::jsonb)
  );

  insert into public.droxion_wallet_transactions(
    user_id, amount, transaction_type, balance_after, provider, provider_transaction_id, metadata
  ) values (
    p_user_id, p_coins, 'coin_purchase', v_balance, 'google_play', btrim(p_purchase_token),
    jsonb_build_object('order_id', p_order_id, 'product_id', p_product_id, 'package_id', p_package_id)
  );

  return jsonb_build_object('ok', true, 'already_completed', false, 'coins', p_coins, 'coin_balance', v_balance);
end;
$$;

revoke all on function public.droxion_fulfill_google_purchase(uuid,text,text,text,text,integer,integer,integer,integer,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.droxion_fulfill_google_purchase(uuid,text,text,text,text,integer,integer,integer,integer,timestamptz,jsonb) to service_role;

update public.droxion_products
set google_product_id = apple_product_id
where product_type = 'coin_pack' and apple_product_id is not null and google_product_id is null;
