-- Droxion Phase 1: 25-gift catalog
-- Server-authoritative prices only. This does not modify LIVE media, LiveKit,
-- wallet accounting, creator/platform split, or gift-send transaction logic.

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
  -- Low-cost
  ('rose',              'Rose',              '🌹',     5, true,  10),
  ('heart',             'Heart',             '💜',    10, true,  20),
  ('star',              'Star',              '⭐',    25, true,  30),
  ('coffee',            'Coffee',            '☕',    40, true,  40),
  ('sparkle',           'Sparkle',           '✨',    50, true,  50),

  -- Popular
  ('teddy',             'Teddy',             '🧸',    75, true,  60),
  ('crown',             'Crown',             '👑',   100, true,  70),
  ('cake',              'Celebration Cake',  '🎂',   150, true,  80),
  ('fire',              'Fire',              '🔥',   250, true,  90),
  ('rocket',            'Rocket',            '🚀',   500, true, 100),

  -- Premium
  ('diamond',           'Diamond',           '💎',   750, true, 110),
  ('supercar',          'Supercar',          '🏎️',  1000, true, 120),
  ('treasure',          'Treasure',          '🪙',  1500, true, 130),
  ('castle',            'Castle',            '🏰',  2500, true, 140),
  ('dragon',            'Dragon',            '🐉',  3000, true, 150),

  -- Elite
  ('droxion_galaxy',    'Droxion Galaxy',    '🌌',  5000, true, 160),
  ('lion',              'Royal Lion',        '🦁',  7500, true, 170),
  ('private_jet',       'Private Jet',       '✈️', 10000, true, 180),
  ('yacht',             'Luxury Yacht',      '🛥️', 12500, true, 190),
  ('phoenix',           'Phoenix',           '🔥', 15000, true, 200),

  -- Legendary
  ('meteor_storm',      'Meteor Storm',      '☄️', 20000, true, 210),
  ('droxion_universe',  'Droxion Universe',  '🪐', 25000, true, 220),
  ('royal_throne',      'Royal Throne',      '🪑', 30000, true, 230),
  ('world_crown',       'World Crown',       '🌍', 40000, true, 240),
  ('droxion_royalty',   'Droxion Royalty',   '🏆', 50000, true, 250)
on conflict (gift_code) do update set
  gift_name = excluded.gift_name,
  emoji = excluded.emoji,
  cost_coins = excluded.cost_coins,
  active = excluded.active,
  sort_order = excluded.sort_order;

-- Guardrail: this migration must leave the intended active catalog complete.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.droxion_gift_catalog
  where active is true
    and gift_code in (
      'rose','heart','star','coffee','sparkle',
      'teddy','crown','cake','fire','rocket',
      'diamond','supercar','treasure','castle','dragon',
      'droxion_galaxy','lion','private_jet','yacht','phoenix',
      'meteor_storm','droxion_universe','royal_throne','world_crown','droxion_royalty'
    );

  if v_count <> 25 then
    raise exception 'Droxion Phase 1 gift catalog expected 25 active gifts, found %', v_count;
  end if;
end $$;

commit;
