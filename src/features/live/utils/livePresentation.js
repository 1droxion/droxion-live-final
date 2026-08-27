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
  const name = String(gift.gift_name || gift.name || '').toLowerCase();

  if (
    cost >= 1000 ||
    /(lion|jet|galaxy|diamond|supercar|car|castle|dragon|universe|treasure)/.test(name)
  ) {
    return { tier: 'premium', duration: 3600 };
  }

  if (
    cost >= 150 ||
    /(crown|rocket|fire|teddy|cake|champagne|star)/.test(name)
  ) {
    return { tier: 'featured', duration: 2600 };
  }

  return { tier: 'standard', duration: 1800 };
}
