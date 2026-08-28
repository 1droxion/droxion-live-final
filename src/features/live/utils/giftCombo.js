export const GIFT_COMBO_WINDOW_MS = 15000;

function senderKey(gift = {}) {
  return String(gift.sender_id || gift.user_id || gift.sender_name || gift.display_name || '').trim().toLowerCase();
}

function giftKey(gift = {}) {
  return String(gift.gift_code || gift.code || gift.gift_name || gift.name || '').trim().toLowerCase();
}

function giftTime(gift = {}) {
  const parsed = Date.parse(gift.created_at || gift.sent_at || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function giftEventKey(gift = {}) {
  if (gift.id !== undefined && gift.id !== null && gift.id !== '') return `id:${gift.id}`;
  return [
    gift.created_at || gift.sent_at || '',
    senderKey(gift),
    giftKey(gift),
    gift.cost_coins ?? gift.coin_cost ?? ''
  ].join(':');
}

export function getGiftCombo(giftEvents = []) {
  const latest = giftEvents[giftEvents.length - 1];
  if (!latest) return { count: 0, level: 0, windowMs: GIFT_COMBO_WINDOW_MS };

  const latestSender = senderKey(latest);
  const latestGift = giftKey(latest);
  const latestTime = giftTime(latest);
  let count = 0;

  for (let index = giftEvents.length - 1; index >= 0; index -= 1) {
    const event = giftEvents[index];
    const eventTime = giftTime(event);

    if (latestTime && eventTime && latestTime - eventTime > GIFT_COMBO_WINDOW_MS) break;
    if (senderKey(event) === latestSender && giftKey(event) === latestGift) count += 1;
  }

  const level = count >= 5 ? 5 : count >= 3 ? 3 : count >= 2 ? 2 : 0;
  return { count: Math.max(1, count), level, windowMs: GIFT_COMBO_WINDOW_MS };
}
