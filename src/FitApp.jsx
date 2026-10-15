import { useEffect, useMemo, useState } from "react";
import { isAppleStore, watchAppleEntitlements } from "./fit/store.js";
import { ROUTINE_KEY, emptyRoutine, addGrocery } from "./fit/routine.js";
import Onboarding from "./fit/components/Onboarding.jsx";
import Dashboard from "./fit/components/Dashboard.jsx";
import Paywall from "./fit/components/Paywall.jsx";
import LegalPage from "./fit/components/LegalPage.jsx";
import { trackEvent } from "./fit/analytics.js";
import { clamp, dayKey } from "./fit/nutrition.js";
import {
  clearUserData,
  readJson, writeJson,
  getEntitlementMeta,
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
  const [routine, setRoutine] = useState(() => readJson(ROUTINE_KEY, emptyRoutine()));
  const [routineError, setRoutineError] = useState("");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [entitlementVersion, setEntitlementVersion] = useState(0);
  const legalPage = currentLegalPage();

  const pro = useMemo(() => {
    const meta = getEntitlementMeta();
    if (!meta?.active) return false;
    if (isAppleStore() && meta.verification !== "storekit") return false;
    if (!meta.expiresAt) return !isAppleStore();
    const expires = Date.parse(meta.expiresAt);
    return Number.isFinite(expires) && expires > Date.now();
  }, [entitlementVersion]);


  useEffect(() => watchAppleEntitlements(() => setEntitlementVersion(value => value + 1)), []);

  if (legalPage) return <LegalPage page={legalPage} />;

  function completeOnboarding(nextProfile) {
    saveProfile(nextProfile);
    setProfile(nextProfile);
    trackEvent("onboarding_completed", { goal: nextProfile.goal });
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
    if (!window.confirm("Reset your Droxion Fit profile, meals, grocery list, and workout history? Your subscription will not be reset.")) return;
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
        profile={profile}
        meals={meals}
        pro={pro}
        onOpenPaywall={() => setPaywallOpen(true)}
        onReset={resetLocalData}
        onAddMeal={saveMeal}
        onUpdateMeal={updateMeal}
        onDeleteMeal={deleteMeal}
      />


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
