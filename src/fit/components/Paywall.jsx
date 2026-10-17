import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import {
  isNativeStore,
  loadSubscriptionProducts,
  manageSubscription,
  purchasePlan,
  restorePro
} from "../store.js";
import { trackEvent } from "../analytics.js";

export default function Paywall({ onClose, onActivated }) {
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState("monthly");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const native = isNativeStore();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setProducts([]);
    trackEvent("paywall_viewed", { source: "app" });
    loadSubscriptionProducts()
      .then(rows => { if (alive) setProducts(rows.filter(product => product.id === "monthly")); })
      .catch(() => { if (alive) setError("We couldn’t load the store price. Check your connection, then try again. You have not been charged."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [attempt]);

  const selectedProduct = products.find(item => item.id === selected);

  async function buy() {
    if (!native) {
      setError("Open Droxion Fit on iPhone or Android to subscribe.");
      return;
    }
    setBusy("buy");
    setError("");
    try {
      const result = await purchasePlan(selected);
      trackEvent("subscription_started", { plan: selected, platform: result?.platform || "native" });
      onActivated(result);
    } catch (err) {
      if (!/cancel/i.test(String(err?.message || ""))) {
        setError(err?.message || "Subscription was not completed.");
      }
    } finally {
      setBusy("");
    }
  }

  async function restore() {
    setBusy("restore");
    setError("");
    try {
      const result = await restorePro();
      if (!result) throw new Error("No active Droxion Plus subscription was found.");
      trackEvent("subscription_restored", { platform: result.platform || "native" });
      onActivated(result);
    } catch (err) {
      setError(err?.message || "Could not restore purchases.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="fitModalBackdrop" role="dialog" aria-modal="true" aria-label="Droxion Plus">
      <section className="fitPaywall">
        <button type="button" className="fitIconButton fitClose" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <img className="fitPaywallArt" src="/daily-routine.svg" alt="Meal diary, grocery basket and home exercise" />
        <span className="fitEyebrow">DROXION PLUS</span>
        <h2>Track your food. Build your daily habit.</h2>
        <p>Meal history, 7-day progress and short home workouts. Cancel anytime in your App Store or Google Play subscription settings.</p>

        <div className="fitBenefits">
          <div><Check size={18} /> Review your meal history</div>
          <div><Check size={18} /> Track your 7-day nutrition progress</div>
          <div><Check size={18} /> Short home workouts</div>
        </div>

        {loading ? <div className="fitMuted">Loading store prices…</div> : products.map(product => (
          <button
            type="button"
            key={product.id}
            className={"fitPlan" + (selected === product.id ? " featured" : "")}
            onClick={() => setSelected(product.id)}
          >
            <div>
              <strong>Droxion Plus Monthly</strong>
              <span>{product.id === "yearly" ? "Best value" : "Flexible monthly plan"}</span>
            </div>
            <b>{product.priceString}<small> / month</small></b>
          </button>
        ))}

        {error && <div role="alert" className="fitInlineError">{error}</div>}
        {!loading && !selectedProduct && <button type="button" className="fitSecondary fitWide" disabled={Boolean(busy)} onClick={() => setAttempt(value => value + 1)}>Try loading price again</button>}

        <button type="button" className="fitPrimary fitWide" onClick={buy} disabled={busy || loading || !selectedProduct || (native && !selectedProduct.nativeProduct)}>
          {busy === "buy" ? "Connecting to store…" : native ? "Subscribe monthly" : "Available in the mobile app"}
        </button>

        <div className="fitPaywallLinks">
          <button type="button" onClick={restore} disabled={busy || !native}>{busy === "restore" ? "Restoring…" : "Restore purchases"}</button>
          {native && <button type="button" onClick={() => manageSubscription().catch(() => {})}>Manage subscription</button>}
        </div>

        <div className="fitLegalLinks">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
        </div>
        <small className="fitPaywallNote">Payment is charged to your Apple ID or Google Play account. Subscription renews automatically unless cancelled through your store account.</small>
      </section>
    </div>
  );
}
