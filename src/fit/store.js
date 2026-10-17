import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";
import { selectAppleEntitlement } from "./apple-entitlements.js";
import { PLAN_IDS } from "./constants.js";
import { getInstallId, setEntitlement, clearEntitlement } from "./storage.js";
import { ensureInstallToken, verifyStoreSubscription } from "./api.js";

function platform() {
  try {
    const value = Capacitor.getPlatform?.();
    return value === "ios" || value === "android" ? value : "web";
  } catch {
    return "web";
  }
}

export function isNativeStore() {
  return platform() !== "web";
}

function productKey(product) {
  return String(product?.identifier || product?.productIdentifier || product?.productId || "");
}

function transactionToken(transaction) {
  return String(
    transaction?.purchaseToken ||
    transaction?.token ||
    transaction?.transactionId ||
    ""
  ).trim();
}

function storeRead(promise) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("The store is taking too long to respond. Please try loading the price again.")), 15000);
    })
  ]).finally(() => clearTimeout(timer));
}

export async function loadSubscriptionProducts() {
  // Only request the monthly plan offered in the app and configured in the store.
  const plans = [PLAN_IDS.monthly];
  if (!isNativeStore()) {
    return plans.map(plan => ({
      ...plan,
      priceString: plan.fallbackPrice.replace(/\/month$/, "")
    }));
  }

  const { isBillingSupported } = await storeRead(NativePurchases.isBillingSupported());
  if (!isBillingSupported) throw new Error("Subscriptions are not available on this device.");

  const identifiers = plans.map(plan => plan.productId);
  const { products } = await storeRead(NativePurchases.getProducts({
    productIdentifiers: identifiers,
    productType: PURCHASE_TYPE.SUBS
  }));

  const map = new Map((products || []).map(product => [productKey(product), product]));
  if (!map.has(PLAN_IDS.monthly.productId)) {
    throw new Error("The store could not load Droxion Plus Monthly. Check your connection and try again. You have not been charged.");
  }
  return plans.map(plan => {
    const nativeProduct = map.get(plan.productId) || null;
    return {
      ...plan,
      nativeProduct,
      priceString: nativeProduct?.priceString || (nativeProduct?.price ? String(nativeProduct.price) : "Unavailable")
    };
  });
}

// Apple verifies signatures in native StoreKit; no domain or install-token server.
export function isAppleStore() { return platform() === "ios"; }

export async function refreshAppleEntitlement() {
  if (!isAppleStore()) return null;
  const { purchases } = await NativePurchases.getPurchases({
    productType: PURCHASE_TYPE.SUBS,
    onlyCurrentEntitlements: true
  });
  const result = selectAppleEntitlement(purchases);
  if (result) setEntitlement("", result);
  else clearEntitlement();
  return result;
}

export function watchAppleEntitlements(onChange) {
  if (!isAppleStore()) return () => {};
  let stopped = false;
  const refresh = () => refreshAppleEntitlement().then(() => {
    if (!stopped) onChange();
  }).catch(() => { /* Keep the last verified access only until its expiry. */ });
  const visible = () => { if (!document.hidden) refresh(); };
  const subscriptions = ["transactionUpdated", "transactionVerificationFailed"].map(event =>
    NativePurchases.addListener(event, refresh).then(handle => {
      if (stopped) handle.remove();
      return handle;
    }).catch(() => null)
  );
  document.addEventListener("visibilitychange", visible);
  window.addEventListener("focus", refresh);
  // Also re-evaluate expiry while the app remains open.
  const interval = setInterval(() => { onChange(); refresh(); }, 60000);
  refresh();
  return () => {
    stopped = true;
    clearInterval(interval);
    document.removeEventListener("visibilitychange", visible);
    window.removeEventListener("focus", refresh);
    subscriptions.forEach(promise => promise.then(handle => handle?.remove()));
  };
}

async function verifyAndStore(transaction, selectedPlan) {
  const currentPlatform = platform();
  const result = await verifyStoreSubscription(currentPlatform, {
    productId: selectedPlan?.productId || productKey(transaction),
    purchaseToken: transactionToken(transaction),
    transactionId: String(transaction?.transactionId || ""),
    jwsRepresentation: String(transaction?.jwsRepresentation || ""),
    receipt: String(transaction?.receipt || "")
  });

  if (!result?.active || !result?.entitlementToken) {
    throw new Error("The store did not confirm an active Droxion Fit Pro subscription.");
  }

  setEntitlement(result.entitlementToken, {
    active: true,
    productId: result.productId,
    expiresAt: result.expiresAt || null,
    platform: currentPlatform
  });

  try {
    const token = currentPlatform === "android"
      ? transactionToken(transaction)
      : String(transaction?.transactionId || "");
    if (token) await NativePurchases.acknowledgePurchase({ purchaseToken: token });
  } catch {}

  return result;
}

export async function purchasePlan(planId) {
  if (!isNativeStore()) {
    throw new Error("Subscriptions can only be purchased inside the iPhone or Android app.");
  }

  const selectedPlan = PLAN_IDS[planId];
  if (!selectedPlan) throw new Error("Unknown subscription plan.");

  const currentPlatform = platform();
  const options = {
    productIdentifier: selectedPlan.productId,
    productType: PURCHASE_TYPE.SUBS,
    appAccountToken: getInstallId(),
    autoAcknowledgePurchases: false
  };

  if (currentPlatform === "android") {
    options.planIdentifier = selectedPlan.androidPlanId;
  }

  // Android still requires its server verifier; iOS uses native StoreKit.
  if (currentPlatform !== "ios") await ensureInstallToken();
  const transaction = await NativePurchases.purchaseProduct(options);
  if (currentPlatform === "ios") {
    const result = await refreshAppleEntitlement();
    if (!result) throw new Error("Apple has not confirmed active Plus access yet. Try Restore purchases; do not purchase again.");
    if (transaction.transactionId) {
      await NativePurchases.acknowledgePurchase({ purchaseToken: String(transaction.transactionId) }).catch(() => {});
    }
    return result;
  }
  return verifyAndStore(transaction, selectedPlan);
}

export async function restorePro() {
  if (!isNativeStore()) return null;

  await NativePurchases.restorePurchases();
  if (isAppleStore()) return refreshAppleEntitlement();
  const { purchases } = await NativePurchases.getPurchases({
    productType: PURCHASE_TYPE.SUBS
  });

  const known = new Set(Object.values(PLAN_IDS).map(plan => plan.productId));
  const candidates = (purchases || []).filter(item => known.has(productKey(item)));

  for (const transaction of candidates) {
    const plan = Object.values(PLAN_IDS).find(item => item.productId === productKey(transaction));
    try {
      const result = await verifyAndStore(transaction, plan);
      if (result?.active) return result;
    } catch {}
  }

  clearEntitlement();
  return null;
}

export async function manageSubscription() {
  if (!isNativeStore()) return;
  await NativePurchases.manageSubscriptions();
}
