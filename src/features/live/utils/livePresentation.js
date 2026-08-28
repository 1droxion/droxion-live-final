const LIVE_USER_COLORS = [
  '#c084fc',
  '#f472b6',
  '#60a5fa',
  '#22d3ee',
  '#34d399',
  '#facc15',
  '#fb923c',
  '#f87171',
  '#a78bfa',
  '#2dd4bf'
];

const CINEMA_DURATION_SCALE = 0.8;

const SIGNATURE_GIFT_CONFIG = {
  rose: { scene: 'rose_petals', soundProfile: 'rose', duration: 2200, takeoverLevel: 'light' },
  heart: { scene: 'heart_pulse', soundProfile: 'heart', duration: 2300, takeoverLevel: 'light' },
  star: { scene: 'star_burst', soundProfile: 'star', duration: 2350, takeoverLevel: 'light' },
  coffee: { scene: 'coffee_steam', soundProfile: 'coffee', duration: 2400, takeoverLevel: 'light' },
  sparkle: { scene: 'sparkle_rain', soundProfile: 'sparkle', duration: 2450, takeoverLevel: 'light' },
  teddy: { scene: 'teddy_hug', soundProfile: 'teddy', duration: 2850, takeoverLevel: 'light' },
  crown: { scene: 'crown_drop', soundProfile: 'crown', duration: 3000, takeoverLevel: 'medium' },
  cake: { scene: 'cake_party', soundProfile: 'cake', duration: 3050, takeoverLevel: 'medium' },
  fire: { scene: 'fire_wave', soundProfile: 'fire', duration: 3150, takeoverLevel: 'medium' },
  rocket: { scene: 'rocket_launch', soundProfile: 'rocket', duration: 3400, takeoverLevel: 'medium' },
  diamond: { scene: 'diamond_prism', soundProfile: 'diamond', duration: 3900, takeoverLevel: 'high' },
  supercar: { scene: 'supercar_drive', soundProfile: 'supercar', duration: 4100, takeoverLevel: 'high' },
  treasure: { scene: 'treasure_open', soundProfile: 'treasure', duration: 4200, takeoverLevel: 'high' },
  castle: { scene: 'castle_reveal', soundProfile: 'castle', duration: 4300, takeoverLevel: 'high' },
  dragon: { scene: 'dragon_fire', soundProfile: 'dragon', duration: 4600, takeoverLevel: 'high' },
  droxion_galaxy: { scene: 'galaxy_blast', soundProfile: 'galaxy', duration: 5000, takeoverLevel: 'full' },
  lion: { scene: 'lion_roar', soundProfile: 'lion', duration: 4800, takeoverLevel: 'full' },
  private_jet: { scene: 'jet_flyby', soundProfile: 'jet', duration: 4700, takeoverLevel: 'full' },
  yacht: { scene: 'yacht_glide', soundProfile: 'yacht', duration: 4800, takeoverLevel: 'full' },
  phoenix: { scene: 'phoenix_rise', soundProfile: 'phoenix', duration: 5200, takeoverLevel: 'full' },
  meteor_storm: { scene: 'meteor_storm', soundProfile: 'meteor', duration: 5450, takeoverLevel: 'full' },
  droxion_universe: { scene: 'universe_expand', soundProfile: 'universe', duration: 5600, takeoverLevel: 'full' },
  royal_throne: { scene: 'throne_ascend', soundProfile: 'throne', duration: 5700, takeoverLevel: 'full' },
  world_crown: { scene: 'world_crown_orbit', soundProfile: 'world_crown', duration: 5800, takeoverLevel: 'full' },
  droxion_royalty: { scene: 'royalty_reveal', soundProfile: 'royalty', duration: 5900, takeoverLevel: 'full' }
};

const NAME_TO_CODE = [
  [/droxion royalty/, 'droxion_royalty'],
  [/world crown/, 'world_crown'],
  [/royal throne|\bthrone\b/, 'royal_throne'],
  [/droxion universe/, 'droxion_universe'],
  [/meteor storm|\bmeteor\b/, 'meteor_storm'],
  [/phoenix/, 'phoenix'],
  [/luxury yacht|\byacht\b/, 'yacht'],
  [/private jet|\bjet\b/, 'private_jet'],
  [/royal lion|\blion\b/, 'lion'],
  [/droxion galaxy|\bgalaxy\b/, 'droxion_galaxy'],
  [/dragon/, 'dragon'],
  [/castle/, 'castle'],
  [/treasure/, 'treasure'],
  [/supercar|super car/, 'supercar'],
  [/diamond/, 'diamond'],
  [/rocket/, 'rocket'],
  [/\bfire\b/, 'fire'],
  [/cake/, 'cake'],
  [/\bcrown\b/, 'crown'],
  [/teddy/, 'teddy'],
  [/sparkle/, 'sparkle'],
  [/coffee/, 'coffee'],
  [/\bstar\b/, 'star'],
  [/heart/, 'heart'],
  [/rose/, 'rose']
];

function hashText(value) {
  let hash = 2166136261;
  const text = String(value || 'viewer');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function tierForCode(code, cost) {
  if (['meteor_storm', 'droxion_universe', 'royal_throne', 'world_crown', 'droxion_royalty'].includes(code) || cost >= 20000) return 'legendary';
  if (['droxion_galaxy', 'lion', 'private_jet', 'yacht', 'phoenix'].includes(code) || cost >= 5000) return 'elite';
  if (['diamond', 'supercar', 'treasure', 'castle', 'dragon'].includes(code) || cost >= 750) return 'premium';
  if (['teddy', 'crown', 'cake', 'fire', 'rocket'].includes(code) || cost >= 75) return 'featured';
  return 'standard';
}

function fasterDuration(ms) {
  return Math.max(900, Math.round(Number(ms || 0) * CINEMA_DURATION_SCALE));
}

export function getLiveUserColor(userId, displayName) {
  const key = String(userId || displayName || 'viewer');
  return LIVE_USER_COLORS[hashText(key) % LIVE_USER_COLORS.length];
}

export function getGiftPresentation(gift = {}) {
  const cost = Number(gift.cost_coins ?? gift.coin_cost ?? gift.coins ?? 0);
  const code = String(gift.gift_code || gift.code || '').toLowerCase();
  const name = String(gift.gift_name || gift.name || '').toLowerCase();
  const key = `${code} ${name}`;

  const resolvedCode = SIGNATURE_GIFT_CONFIG[code]
    ? code
    : NAME_TO_CODE.find(([pattern]) => pattern.test(key))?.[1];

  if (resolvedCode && SIGNATURE_GIFT_CONFIG[resolvedCode]) {
    const config = SIGNATURE_GIFT_CONFIG[resolvedCode];
    return {
      tier: tierForCode(resolvedCode, cost),
      ...config,
      duration: fasterDuration(config.duration)
    };
  }

  if (cost >= 20000) {
    return { tier: 'legendary', duration: fasterDuration(5200), scene: 'legendary_generic', soundProfile: 'legendary_stinger', takeoverLevel: 'full' };
  }
  if (cost >= 5000) {
    return { tier: 'elite', duration: fasterDuration(4400), scene: 'elite_generic', soundProfile: 'elite_impact', takeoverLevel: 'high' };
  }
  if (cost >= 750) {
    return { tier: 'premium', duration: fasterDuration(3600), scene: 'premium_generic', soundProfile: 'premium_whoosh', takeoverLevel: 'medium' };
  }
  if (cost >= 75) {
    return { tier: 'featured', duration: fasterDuration(2600), scene: 'featured_generic', soundProfile: 'sparkle_chime', takeoverLevel: 'light' };
  }
  return { tier: 'standard', duration: fasterDuration(1800), scene: 'standard_generic', soundProfile: 'standard_pop', takeoverLevel: 'light' };
}
