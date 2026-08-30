-- Add premium Droxion coin packs without exposing them before the matching
-- App Store / Play Store consumable products exist.
-- Activation is intentionally separate from catalog creation.

insert into public.droxion_products (
  id,
  product_type,
  name,
  price_cents,
  currency,
  coins_granted,
  plan,
  billing_period_days,
  active,
  sort_order,
  apple_product_id,
  google_product_id,
  updated_at
)
values
  (
    'coins_6500',
    'coin_pack',
    '6,500 Coins',
    5999,
    'USD',
    6500,
    null,
    null,
    false,
    50,
    'com.droxion.live.coins6500',
    'com.droxion.live.coins6500',
    now()
  ),
  (
    'coins_11500',
    'coin_pack',
    '11,500 Coins',
    9999,
    'USD',
    11500,
    null,
    null,
    false,
    60,
    'com.droxion.live.coins11500',
    'com.droxion.live.coins11500',
    now()
  )
on conflict (id) do update
set
  product_type = excluded.product_type,
  name = excluded.name,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  coins_granted = excluded.coins_granted,
  sort_order = excluded.sort_order,
  apple_product_id = excluded.apple_product_id,
  google_product_id = excluded.google_product_id,
  updated_at = now();
