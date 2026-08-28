-- Droxion Phase 1: larger coin packs
-- These products are intentionally staged INACTIVE until the matching
-- App Store / Google Play in-app products exist and have been tested.
-- Keeping them inactive prevents native clients from offering unconfigured SKUs.

begin;

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
  ('coins_5000',  'coin_pack', '5,000 Coins',  4999, 'USD',  5000, null, null, false, 50, 'com.droxion.live.coins5000',  'com.droxion.live.coins5000',  now()),
  ('coins_11000', 'coin_pack', '11,000 Coins', 9999, 'USD', 11000, null, null, false, 60, 'com.droxion.live.coins11000', 'com.droxion.live.coins11000', now()),
  ('coins_24000', 'coin_pack', '24,000 Coins', 19999,'USD', 24000, null, null, false, 70, 'com.droxion.live.coins24000', 'com.droxion.live.coins24000', now()),
  ('coins_50000', 'coin_pack', '50,000 Coins', 39999,'USD', 50000, null, null, false, 80, 'com.droxion.live.coins50000', 'com.droxion.live.coins50000', now())
on conflict (id) do update set
  product_type = excluded.product_type,
  name = excluded.name,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  coins_granted = excluded.coins_granted,
  plan = excluded.plan,
  billing_period_days = excluded.billing_period_days,
  active = false,
  sort_order = excluded.sort_order,
  apple_product_id = excluded.apple_product_id,
  google_product_id = excluded.google_product_id,
  updated_at = now();

-- Guardrail: staged packs must remain inactive until store configuration is ready.
do $$
declare
  v_active_count integer;
begin
  select count(*) into v_active_count
  from public.droxion_products
  where id in ('coins_5000','coins_11000','coins_24000','coins_50000')
    and active is true;

  if v_active_count <> 0 then
    raise exception 'Large Droxion coin packs must remain inactive until store SKUs are configured.';
  end if;
end $$;

commit;
