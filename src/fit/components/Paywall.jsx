import { useEffect, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
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
  const [selected, setSelected] = useState("yearly");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const native = isNativeStore();

  useEffect(() => {
    let alive = true;
    trackEvent("paywall_viewed", { source: "app" });
    loadSubscriptionProducts()
      .then(rows => { if (alive) setProducts(rows); })
      .catch(err => { if (alive) setError(err?.message || "Could not load subscription options."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

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
      if (!result) throw new Error("No active Droxion Fit Pro subscription was found.");
      trackEvent("subscription_restored", { platform: result.platform || "native" });
      onActivated(result);
    } catch (err) {
      setError(err?.message || "Could not restore purchases.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="fitModalBackdrop" role="dialog" aria-modal="true" aria-label="Droxion Fit Pro">
      <section className="fitPaywall">
        <button type="button" className="fitIconButton fitClose" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="fitPaywallIcon"><Sparkles size={28} /></div>
        <span className="fitEyebrow">DROXION FIT PRO</span>
        <h2>Scan every meal without manual logging.</h2>
        <p>Unlimited AI food scans with calories, protein and macros. Cancel anytime in your App Store or Google Play subscription settings.</p>

        <div className="fitBenefits">
          <div><Check size={18} /> Unlimited AI meal scans</div>
          <div><Check size={18} /> Calories, protein, carbs and fat</div>
          <div><Check size={18} /> Full meal history and 7-day progress</div>
        </div>

        {loading ? <div className="fitMuted">Loading store prices…</div> : products.map(product => (
          <button
            type="button"
            key={product.id}
            className={"fitPlan" + (selected === product.id ? " featured" : "")}
            onClick={() => setSelected(product.id)}
          >
            <div>
              <strong>{product.label}</strong>
              <span>{product.id === "yearly" ? "Best value" : "Flexible monthly plan"}</span>
            </div>
            <b>{product.priceString}</b>
          </button>
        ))}

        {error && <div className="fitInlineError">{error}</div>}

        <button type="button" className="fitPrimary fitWide" onClick={buy} disabled={busy || loading || !selectedProduct}>
          {busy === "buy" ? "Connecting to store…" : native ? "Continue" : "Available in the mobile app"}
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
