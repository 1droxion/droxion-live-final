import { lazy, Suspense, useEffect, useMemo, useState } from "react";
const ProductScanner = lazy(() => import("./fit/components/ProductScanner.jsx"));
import { ROUTINE_KEY, emptyRoutine, addGrocery } from "./fit/routine.js";
import Onboarding from "./fit/components/Onboarding.jsx";
import Scanner from "./fit/components/Scanner.jsx";
import Dashboard from "./fit/components/Dashboard.jsx";
import Paywall from "./fit/components/Paywall.jsx";
import LegalPage from "./fit/components/LegalPage.jsx";
import { ensureInstallToken } from "./fit/api.js";
import { trackEvent } from "./fit/analytics.js";
import { clamp, dayKey } from "./fit/nutrition.js";
import {
  clearUserData,
  readJson, writeJson,
  getEntitlementMeta,
  getFreeRemaining,
  getMeals,
  getProfile,
  saveMeals,
  saveProfile
} from "./fit/storage.js";

function newId() {
  return globalThis.crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2);
}

function currentLegalPage() {
  const path = window.location.pathname.replace(/^\/+/, "").toLowerCase();
  return ["privacy", "terms", "support"].includes(path) ? path : "";
}

export default function FitApp() {
  const [profile, setProfile] = useState(() => getProfile());
  const [meals, setMeals] = useState(() => getMeals());
  const [freeRemaining, setFreeRemainingState] = useState(() => getFreeRemaining());
  const [routine, setRoutine] = useState(() => readJson(ROUTINE_KEY, emptyRoutine()));
  const [routineError, setRoutineError] = useState("");
  const [productScannerOpen, setProductScannerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [entitlementVersion, setEntitlementVersion] = useState(0);
  const legalPage = currentLegalPage();

  const pro = useMemo(() => {
    const meta = getEntitlementMeta();
    if (!meta?.active) return false;
    if (!meta.expiresAt) return true;
    const expires = Date.parse(meta.expiresAt);
    return Number.isFinite(expires) && expires > Date.now();
  }, [entitlementVersion]);

  useEffect(() => {
    let alive = true;
    ensureInstallToken()
      .then(() => {
        if (alive) setFreeRemainingState(getFreeRemaining());
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (legalPage) return <LegalPage page={legalPage} />;

  function completeOnboarding(nextProfile) {
    saveProfile(nextProfile);
    setProfile(nextProfile);
    trackEvent("onboarding_completed", { goal: nextProfile.goal });
  }

  function openScanner() {
    if (!pro && freeRemaining <= 0) {
      setPaywallOpen(true);
      trackEvent("paywall_viewed", { source: "free_limit" });
      return;
    }
    setScannerOpen(true);
  }

  function saveMeal(analysis) {
    const nextMeal = {
      id: newId(),
      date: dayKey(),
      createdAt: new Date().toISOString(),
      name: String(analysis.name || "Meal").slice(0, 80),
      items: Array.isArray(analysis.items) ? analysis.items : [],
      calories: clamp(analysis.calories, 0, 5000),
      protein: clamp(analysis.protein, 0, 500),
      carbs: clamp(analysis.carbs, 0, 700),
      fat: clamp(analysis.fat, 0, 400),
      confidence: String(analysis.confidence || "Estimated"),
      note: String(analysis.note || "").slice(0, 240),
      image: analysis.image || ""
    };
    const nextMeals = [...meals, nextMeal];
    saveMeals(nextMeals);
    setMeals(nextMeals);
    setFreeRemainingState(getFreeRemaining());
    setScannerOpen(false);
  }

  function updateMeal(nextMeal) {
    const normalized = {
      ...nextMeal,
      name: String(nextMeal.name || "Meal").slice(0, 80),
      calories: clamp(nextMeal.calories, 0, 5000),
      protein: clamp(nextMeal.protein, 0, 500),
      carbs: clamp(nextMeal.carbs, 0, 700),
      fat: clamp(nextMeal.fat, 0, 400)
    };
    const nextMeals = meals.map(meal => meal.id === normalized.id ? normalized : meal);
    saveMeals(nextMeals);
    setMeals(nextMeals);
    trackEvent("meal_edited");
  }

  function deleteMeal(id) {
    const nextMeals = meals.filter(meal => meal.id !== id);
    saveMeals(nextMeals);
    setMeals(nextMeals);
    trackEvent("meal_deleted");
  }

  function updateRoutine(next) {
    if (!writeJson(ROUTINE_KEY, next)) { setRoutineError("Could not save on this device. Free up storage and try again."); return false; }
    setRoutine(next); setRoutineError(""); return true;
  }
  function addToGroceries(item) {
    return updateRoutine({ ...routine, groceries: addGrocery(routine.groceries, item) });
  }

  function resetLocalData() {
    if (!window.confirm("Reset your Droxion Fit profile, meals, grocery list, and workout history? Your subscription and free-scan allowance will not be reset.")) return;
    clearUserData();
    localStorage.removeItem(ROUTINE_KEY);
    setRoutine(emptyRoutine());
    setRoutineError("");
    setMeals([]);
    setProfile(null);
  }

  if (!profile) return <Onboarding onComplete={completeOnboarding} />;

  return (
    <>
      <Dashboard
        routine={routine}
        routineError={routineError}
        onRoutineChange={updateRoutine}
        onAddGrocery={addToGroceries}
        onProductScan={() => setProductScannerOpen(true)}
        profile={profile}
        meals={meals}
        freeRemaining={freeRemaining}
        pro={pro}
        onScan={openScanner}
        onOpenPaywall={() => setPaywallOpen(true)}
        onReset={resetLocalData}
        onUpdateMeal={updateMeal}
        onDeleteMeal={deleteMeal}
      />

      {productScannerOpen && <Suspense fallback={<div className="fitModalBackdrop"><section className="fitMealEditor" role="status">Opening product scanner…</section></div>}><ProductScanner onClose={() => setProductScannerOpen(false)} onAdd={addToGroceries} onLog={saveMeal} /></Suspense>}

      {scannerOpen && (
        <Scanner
          freeRemaining={freeRemaining}
          pro={pro}
          onClose={() => {
            setScannerOpen(false);
            setFreeRemainingState(getFreeRemaining());
          }}
          onPaywall={() => {
            setScannerOpen(false);
            setFreeRemainingState(getFreeRemaining());
            setPaywallOpen(true);
          }}
          onSave={saveMeal}
        />
      )}

      {paywallOpen && (
        <Paywall
          onClose={() => setPaywallOpen(false)}
          onActivated={() => {
            setEntitlementVersion(value => value + 1);
            setPaywallOpen(false);
          }}
        />
      )}
    </>
  );
}
