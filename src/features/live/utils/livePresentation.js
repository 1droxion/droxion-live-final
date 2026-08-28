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

const SIGNATURE_GIFT_CONFIG = {
  dragon: {
    scene: 'dragon_fire',
    soundProfile: 'dragon',
    duration: 4600,
    takeoverLevel: 'high'
  },
  droxion_galaxy: {
    scene: 'galaxy_blast',
    soundProfile: 'galaxy',
    duration: 5000,
    takeoverLevel: 'full'
  },
  lion: {
    scene: 'lion_roar',
    soundProfile: 'lion',
    duration: 4800,
    takeoverLevel: 'full'
  },
  private_jet: {
    scene: 'jet_flyby',
    soundProfile: 'jet',
    duration: 4700,
    takeoverLevel: 'full'
  },
  yacht: {
    scene: 'yacht_glide',
    soundProfile: 'yacht',
    duration: 4800,
    takeoverLevel: 'full'
  },
  phoenix: {
    scene: 'phoenix_rise',
    soundProfile: 'phoenix',
    duration: 5200,
    takeoverLevel: 'full'
  },
  droxion_universe: {
    scene: 'universe_expand',
    soundProfile: 'universe',
    duration: 5600,
    takeoverLevel: 'full'
  },
  royal_throne: {
    scene: 'throne_ascend',
    soundProfile: 'throne',
    duration: 5700,
    takeoverLevel: 'full'
  },
  world_crown: {
    scene: 'world_crown_orbit',
    soundProfile: 'world_crown',
    duration: 5800,
    takeoverLevel: 'full'
  },
  droxion_royalty: {
    scene: 'royalty_reveal',
    soundProfile: 'royalty',
    duration: 5900,
    takeoverLevel: 'full'
  }
};

function hashText(value) {
  let hash = 2166136261;
  const text = String(value || 'viewer');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
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

  const fallbackSignatureCode = /dragon/.test(key)
    ? 'dragon'
    : /royal lion|\blion\b/.test(key)
      ? 'lion'
      : /private jet|\bjet\b/.test(key)
        ? 'private_jet'
        : /luxury yacht|\byacht\b/.test(key)
          ? 'yacht'
          : /phoenix/.test(key)
            ? 'phoenix'
            : /royal throne|\bthrone\b/.test(key)
              ? 'royal_throne'
              : /world crown/.test(key)
                ? 'world_crown'
                : null;

  const signature = SIGNATURE_GIFT_CONFIG[code] || (
    fallbackSignatureCode ? SIGNATURE_GIFT_CONFIG[fallbackSignatureCode] : null
  );

  if (signature) {
    const resolvedCode = SIGNATURE_GIFT_CONFIG[code] ? code : fallbackSignatureCode;
    const tier = resolvedCode === 'dragon'
      ? 'premium'
      : ['droxion_universe', 'royal_throne', 'world_crown', 'droxion_royalty'].includes(resolvedCode)
        ? 'legendary'
        : 'elite';
    return { tier, ...signature };
  }

  if (
    cost >= 20000 ||
    /(meteor|universe|royalty|world crown|royal throne)/.test(key)
  ) {
    return {
      tier: 'legendary',
      duration: 5200,
      scene: 'legendary_generic',
      soundProfile: 'legendary_stinger',
      takeoverLevel: 'full'
    };
  }

  if (
    cost >= 5000 ||
    /(galaxy|lion|private jet|yacht|phoenix)/.test(key)
  ) {
    return {
      tier: 'elite',
      duration: 4400,
      scene: 'elite_generic',
      soundProfile: 'elite_impact',
      takeoverLevel: 'high'
    };
  }

  if (
    cost >= 750 ||
    /(diamond|supercar|treasure|castle|dragon)/.test(key)
  ) {
    return {
      tier: 'premium',
      duration: 3600,
      scene: 'premium_generic',
      soundProfile: 'premium_whoosh',
      takeoverLevel: 'medium'
    };
  }

  if (
    cost >= 75 ||
    /(teddy|crown|cake|fire|rocket)/.test(key)
  ) {
    return {
      tier: 'featured',
      duration: 2600,
      scene: 'featured_generic',
      soundProfile: 'sparkle_chime',
      takeoverLevel: 'light'
    };
  }

  return {
    tier: 'standard',
    duration: 1800,
    scene: 'standard_generic',
    soundProfile: 'standard_pop',
    takeoverLevel: 'light'
  };
}
