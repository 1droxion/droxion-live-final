import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Lock, ScanLine } from "lucide-react";
import {
  calculateTargets,
  cmToInches,
  inchesToCm,
  kgToPounds,
  poundsToKg
} from "../nutrition.js";
import { FREE_SCANS } from "../constants.js";

function Brand() {
  return (
    <div className="fitBrand">
      <div className="fitBrandMark"><ScanLine size={24} strokeWidth={2.5} /></div>
      <div><strong>Droxion Fit</strong><span>AI calories + protein</span></div>
    </div>
  );
}

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [unit, setUnit] = useState("imperial");
  const [form, setForm] = useState({
    goal: "lose",
    sex: "male",
    age: 27,
    weightKg: 72,
    heightCm: 173,
    activity: "light"
  });
  const [customTargets, setCustomTargets] = useState(null);
  const calculated = useMemo(() => calculateTargets(form), [form]);
  const targets = customTargets || calculated;

  const goals = [
    { id: "lose", title: "Lose fat", text: "A steady calorie deficit with enough protein.", emoji: "🔥" },
    { id: "gain", title: "Build muscle", text: "More fuel and a higher protein target.", emoji: "💪" },
    { id: "maintain", title: "Maintain", text: "Stay consistent without overthinking meals.", emoji: "⚡" }
  ];

  function patch(key, value) {
    setForm(current => ({ ...current, [key]: value }));
    setCustomTargets(null);
  }

  const totalInches = cmToInches(form.heightCm);
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);

  function setImperialHeight(nextFeet, nextInches) {
    const f = Number.isFinite(Number(nextFeet)) ? Number(nextFeet) : feet;
    const i = Number.isFinite(Number(nextInches)) ? Number(nextInches) : inches;
    patch("heightCm", inchesToCm(f * 12 + i));
  }

  function setTarget(key, value) {
    const next = { ...targets, [key]: Number(value) || 0 };
    setCustomTargets(next);
  }

  return (
    <main className="fitOnboarding">
      <div className="fitOnboardingTop"><Brand /></div>
      <section className="fitOnboardingCard" aria-live="polite">
        <div className="fitStepDots">{[0,1,2].map(index => <span key={index} className={index <= step ? "active" : ""} />)}</div>

        {step === 0 && (
          <>
            <span className="fitEyebrow">YOUR GOAL</span>
            <h1>What are you working toward?</h1>
            <p className="fitLead">We’ll use this only to create a simple starting calorie and protein target.</p>
            <div className="fitGoalGrid">
              {goals.map(goal => (
                <button
                  type="button"
                  className={"fitGoalCard" + (form.goal === goal.id ? " selected" : "")}
                  onClick={() => patch("goal", goal.id)}
                  key={goal.id}
                >
                  <span>{goal.emoji}</span>
                  <div><strong>{goal.title}</strong><small>{goal.text}</small></div>
                  {form.goal === goal.id && <Check size={18} />}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <span className="fitEyebrow">QUICK SETUP</span>
            <h1>Set your starting numbers.</h1>
            <p className="fitLead">These are general wellness estimates. You can edit your targets any time.</p>

            <div className="fitSegment">
              <button type="button" className={unit === "imperial" ? "active" : ""} onClick={() => setUnit("imperial")}>US</button>
              <button type="button" className={unit === "metric" ? "active" : ""} onClick={() => setUnit("metric")}>Metric</button>
            </div>

            <div className="fitFormGrid">
              <label>
                <span>Age</span>
                <input inputMode="numeric" type="number" min="18" max="90" value={form.age} onChange={e => patch("age", e.target.value)} />
              </label>
              <label>
                <span>Sex for calorie estimate</span>
                <select value={form.sex} onChange={e => patch("sex", e.target.value)}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Prefer not to say</option>
                </select>
              </label>

              {unit === "imperial" ? (
                <>
                  <label>
                    <span>Weight (lb)</span>
                    <input inputMode="decimal" type="number" min="80" max="600" value={Math.round(kgToPounds(form.weightKg))} onChange={e => patch("weightKg", poundsToKg(e.target.value))} />
                  </label>
                  <label>
                    <span>Height</span>
                    <div className="fitInlineInputs">
                      <input aria-label="Feet" inputMode="numeric" type="number" min="4" max="7" value={feet} onChange={e => setImperialHeight(e.target.value, inches)} />
                      <small>ft</small>
                      <input aria-label="Inches" inputMode="numeric" type="number" min="0" max="11" value={inches} onChange={e => setImperialHeight(feet, e.target.value)} />
                      <small>in</small>
                    </div>
                  </label>
                </>
              ) : (
                <>
                  <label>
                    <span>Weight (kg)</span>
                    <input inputMode="decimal" type="number" min="35" max="275" value={Math.round(form.weightKg * 10) / 10} onChange={e => patch("weightKg", e.target.value)} />
                  </label>
                  <label>
                    <span>Height (cm)</span>
                    <input inputMode="numeric" type="number" min="130" max="230" value={Math.round(form.heightCm)} onChange={e => patch("heightCm", e.target.value)} />
                  </label>
                </>
              )}

              <label className="fitFull">
                <span>Activity</span>
                <select value={form.activity} onChange={e => patch("activity", e.target.value)}>
                  <option value="sedentary">Mostly sitting</option>
                  <option value="light">Lightly active</option>
                  <option value="moderate">Active 3–5 days/week</option>
                  <option value="active">Very active</option>
                </select>
              </label>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <span className="fitEyebrow">YOUR STARTING PLAN</span>
            <h1>Two numbers to care about.</h1>
            <p className="fitLead">Calories control the goal. Protein helps you stay full and support muscle. Edit them if you already know your targets.</p>
            <div className="fitTargetHero">
              <label><input inputMode="numeric" type="number" min="1200" max="4500" value={targets.calories} onChange={e => setTarget("calories", e.target.value)} /><span>calories / day</span></label>
              <label><input inputMode="numeric" type="number" min="55" max="260" value={targets.protein} onChange={e => setTarget("protein", e.target.value)} /><span>protein / day</span></label>
            </div>
            <div className="fitTargetMini">
              <div><span>Carbs</span><strong>{targets.carbs}g</strong></div>
              <div><span>Fat</span><strong>{targets.fat}g</strong></div>
              <div><span>Free AI scans</span><strong>{FREE_SCANS}</strong></div>
            </div>
            <div className="fitTrust"><Lock size={16} /><span>Meal photos are sent only for analysis. Nutrition results are estimates, not medical advice.</span></div>
          </>
        )}

        <div className="fitOnboardingActions">
          {step > 0 && <button type="button" className="fitGhost" onClick={() => setStep(step - 1)}><ChevronLeft size={18} /> Back</button>}
          <button
            type="button"
            className="fitPrimary"
            onClick={() => {
              if (step < 2) return setStep(step + 1);
              onComplete({ ...form, unit, targets, createdAt: new Date().toISOString() });
            }}
          >
            {step === 2 ? "Start tracking" : "Continue"} <ChevronRight size={18} />
          </button>
        </div>
      </section>
    </main>
  );
}
