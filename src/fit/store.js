import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";
import { PLAN_IDS } from "./constants.js";
import { getInstallId, setEntitlement, clearEntitlement } from "./storage.js";
import { verifyStoreSubscription } from "./api.js";

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

export async function loadSubscriptionProducts() {
  if (!isNativeStore()) {
    return Object.values(PLAN_IDS).map(plan => ({
      ...plan,
      priceString: plan.fallbackPrice
    }));
  }

  const { isBillingSupported } = await NativePurchases.isBillingSupported();
  if (!isBillingSupported) throw new Error("Subscriptions are not available on this device.");

  const identifiers = Object.values(PLAN_IDS).map(plan => plan.productId);
  const { products } = await NativePurchases.getProducts({
    productIdentifiers: identifiers,
    productType: PURCHASE_TYPE.SUBS
  });

  const map = new Map((products || []).map(product => [productKey(product), product]));
  return Object.values(PLAN_IDS).map(plan => {
    const nativeProduct = map.get(plan.productId) || null;
    return {
      ...plan,
      nativeProduct,
      priceString: nativeProduct?.priceString || nativeProduct?.price || plan.fallbackPrice
    };
  });
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

  const transaction = await NativePurchases.purchaseProduct(options);
  return verifyAndStore(transaction, selectedPlan);
}

export async function restorePro() {
  if (!isNativeStore()) return null;

  await NativePurchases.restorePurchases();
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
