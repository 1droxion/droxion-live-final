export const APP_NAME = "Droxion Fit";
export const FREE_SCANS = 3;

export const STORAGE_KEYS = {
  profile: "droxion.fit.profile.v2",
  meals: "droxion.fit.meals.v2",
  installId: "droxion.fit.install_id.v1",
  scanToken: "droxion.fit.scan_token.v1",
  freeRemaining: "droxion.fit.free_remaining.v1",
  entitlementToken: "droxion.fit.entitlement.v1",
  entitlementMeta: "droxion.fit.entitlement_meta.v1"
};

export const PLAN_IDS = {
  monthly: {
    id: "monthly",
    label: "Monthly",
    productId: "com.droxion.fit.pro.monthly",
    androidPlanId: "monthly",
    fallbackPrice: "$9.99/month"
  },
  yearly: {
    id: "yearly",
    label: "Yearly",
    productId: "com.droxion.fit.pro.yearly",
    androidPlanId: "yearly",
    fallbackPrice: "$39.99/year"
  }
};

export const SUPPORT_EMAIL = "support@droxion.com";
