-- Droxion Phase 2: expand the server-authoritative catalog from 25 to 40 gifts.
-- Additive only: no changes to LIVE media, LiveKit, wallet accounting, payout
-- splits, or the gift transaction function.

begin;

insert into public.droxion_gift_catalog (
  gift_code,
  gift_name,
  emoji,
  cost_coins,
  active,
  sort_order
)
values
  ('neon_bloom',     'Neon Bloom',     '🌺',   15, true,  25),
  ('lucky_seven',    'Lucky Seven',    '🎰',   20, true,  27),
  ('finger_heart',   'Finger Heart',   '🫰',   30, true,  35),
  ('candy_pop',      'Candy Pop',      '🍭',   35, true,  37),
  ('soccer_strike',  'Soccer Strike',  '⚽',   60, true,  55),
  ('hello_wave',     'Hello Wave',     '👋',   90, true,  65),
  ('snapshot',       'Snapshot',       '📸',  125, true,  75),
  ('game_on',        'Game On',        '🎮',  200, true,  85),
  ('chocolate_box',  'Chocolate Box',  '🍫',  300, true,  95),
  ('party_drop',     'Party Drop',     '🎁',  400, true,  97),
  ('magic_mirror',   'Magic Mirror',   '🪞',  650, true, 105),
  ('music_drop',     'Music Drop',     '🎧',  900, true, 115),
  ('angel_wings',    'Angel Wings',    '🪽', 1200, true, 125),
  ('electric_orb',   'Electric Orb',   '⚡', 1800, true, 135),
  ('moon_kiss',      'Moon Kiss',      '🌙', 2200, true, 145)
on conflict (gift_code) do update set
  gift_name = excluded.gift_name,
  emoji = excluded.emoji,
  cost_coins = excluded.cost_coins,
  active = excluded.active,
  sort_order = excluded.sort_order;

-- Guardrail: the intended original Droxion catalog should contain all 40 gifts.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.droxion_gift_catalog
  where active is true
    and gift_code in (
      'rose','heart','neon_bloom','lucky_seven','star','finger_heart','candy_pop','coffee','sparkle','soccer_strike',
      'teddy','hello_wave','crown','snapshot','cake','game_on','fire','chocolate_box','party_drop','rocket',
      'magic_mirror','diamond','music_drop','supercar','angel_wings','treasure','electric_orb','castle','moon_kiss','dragon',
      'droxion_galaxy','lion','private_jet','yacht','phoenix',
      'meteor_storm','droxion_universe','royal_throne','world_crown','droxion_royalty'
    );

  if v_count <> 40 then
    raise exception 'Droxion Phase 2 gift catalog expected 40 active gifts, found %', v_count;
  end if;
end $$;

commit;
