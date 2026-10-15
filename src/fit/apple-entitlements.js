import { PLAN_IDS } from './constants.js';

// Input must come from the native plugin's verified currentEntitlements query.
export function selectAppleEntitlement(purchases, now = Date.now()) {
  const known = new Set(Object.values(PLAN_IDS).map(plan => plan.productId));
  const active = (purchases || []).filter(item =>
    known.has(item.productIdentifier) && item.transactionId &&
    item.productType === 'subs' && item.isActive === true &&
    !item.revocationDate && !item.isUpgraded &&
    Number.isFinite(Date.parse(item.expirationDate)) && Date.parse(item.expirationDate) > now
  ).sort((a, b) => Date.parse(b.expirationDate) - Date.parse(a.expirationDate));
  const transaction = active[0];
  return transaction ? {
    active: true, productId: transaction.productIdentifier,
    expiresAt: transaction.expirationDate, platform: 'ios',
    verification: 'storekit', transactionId: transaction.transactionId
  } : null;
}
