import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  History,
  Home,
  LineChart,
  Lock,
  Plus,
  RotateCcw,
  ScanLine,
  Settings,
  Sparkles,
  Target,
  Utensils,
  X
} from "lucide-react";

const PROFILE_KEY = "droxion.fit.profile.v1";
const MEALS_KEY = "droxion.fit.meals.v1";
const SCANS_KEY = "droxion.fit.scans.v1";
const FREE_SCANS = 3;

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function dayKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function calculateTargets(profile) {
  const weightKg = profile.unit === "metric" ? Number(profile.weight) : Number(profile.weight) * 0.453592;
  const heightCm = profile.unit === "metric"
    ? Number(profile.height)
    : (Number(profile.heightFeet) * 12 + Number(profile.heightInches)) * 2.54;
  const age = clamp(profile.age, 18, 90);
  const sexOffset = profile.sex === "female" ? -161 : profile.sex === "male" ? 5 : -78;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;
  const activity = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725
  }[profile.activity] || 1.375;
  const goalDelta = profile.goal === "lose" ? -400 : profile.goal === "gain" ? 250 : 0;
  const calories = Math.round(clamp(bmr * activity + goalDelta, 1200, 4500));
  const proteinFactor = profile.goal === "maintain" ? 1.4 : 1.6;
  const protein = Math.round(clamp(weightKg * proteinFactor, 55, 260));
  const fat = Math.round(clamp((calories * 0.28) / 9, 40, 150));
  const carbs = Math.round(clamp((calories - protein * 4 - fat * 9) / 4, 80, 500));
  return { calories, protein, carbs, fat };
}

function sumMeals(meals) {
  return meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + Number(meal.calories || 0),
      protein: acc.protein + Number(meal.protein || 0),
      carbs: acc.carbs + Number(meal.carbs || 0),
      fat: acc.fat + Number(meal.fat || 0)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

async function compressImage(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function Brand({ compact = false }) {
  return (
    <div className={"fitBrand" + (compact ? " compact" : "")}>
      <div className="fitBrandMark"><ScanLine size={compact ? 18 : 24} strokeWidth={2.5} /></div>
      <div>
        <strong>Droxion Fit</strong>
        {!compact && <span>AI calories + protein</span>}
      </div>
    </div>
  );
}

function MetricBar({ label, value, target, unit }) {
  const pct = Math.min(100, Math.round((Number(value || 0) / Math.max(1, Number(target || 1))) * 100));
  return (
    <div className="fitMetric">
      <div className="fitMetricRow">
        <span>{label}</span>
        <strong>{Math.round(value)} / {target}{unit}</strong>
      </div>
      <div className="fitBar"><span style={{ width: pct + "%" }} /></div>
    </div>
  );
}

function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    goal: "lose",
    sex: "male",
    age: 27,
    unit: "imperial",
    weight: 160,
    heightFeet: 5,
    heightInches: 8,
    height: 173,
    activity: "light"
  });
  const targets = useMemo(() => calculateTargets(form), [form]);

  const goals = [
    { id: "lose", title: "Lose fat", text: "Stay in a calorie deficit while protecting protein.", emoji: "🔥" },
    { id: "gain", title: "Build muscle", text: "Prioritize protein and enough fuel for training.", emoji: "💪" },
    { id: "maintain", title: "Maintain", text: "Keep weight steady and make nutrition easy.", emoji: "⚡" }
  ];

  function patch(key, value) {
    setForm(current => ({ ...current, [key]: value }));
  }

  return (
    <main className="fitOnboarding">
      <div className="fitOnboardingTop"><Brand /></div>
      <div className="fitOnboardingCard">
        <div className="fitStepDots">
          {[0, 1, 2].map(index => <span key={index} className={index <= step ? "active" : ""} />)}
        </div>

        {step === 0 && (
          <>
            <span className="fitEyebrow">YOUR GOAL</span>
            <h1>What are we working toward?</h1>
            <p className="fitLead">Droxion Fit uses this to set your starting calorie and protein targets.</p>
            <div className="fitGoalGrid">
              {goals.map(goal => (
                <button
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
            <h1>Build your starting targets.</h1>
            <p className="fitLead">You can change everything later. This is a general wellness estimate, not medical advice.</p>

            <div className="fitSegment">
              <button className={form.unit === "imperial" ? "active" : ""} onClick={() => patch("unit", "imperial")}>US</button>
              <button className={form.unit === "metric" ? "active" : ""} onClick={() => patch("unit", "metric")}>Metric</button>
            </div>

            <div className="fitFormGrid">
              <label>
                <span>Age</span>
                <input type="number" min="18" max="90" value={form.age} onChange={event => patch("age", event.target.value)} />
              </label>
              <label>
                <span>Sex for calorie estimate</span>
                <select value={form.sex} onChange={event => patch("sex", event.target.value)}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Prefer not to say</option>
                </select>
              </label>

              {form.unit === "imperial" ? (
                <>
                  <label>
                    <span>Weight (lb)</span>
                    <input type="number" min="80" max="600" value={form.weight} onChange={event => patch("weight", event.target.value)} />
                  </label>
                  <label>
                    <span>Height</span>
                    <div className="fitInlineInputs">
                      <input aria-label="Feet" type="number" min="4" max="7" value={form.heightFeet} onChange={event => patch("heightFeet", event.target.value)} />
                      <small>ft</small>
                      <input aria-label="Inches" type="number" min="0" max="11" value={form.heightInches} onChange={event => patch("heightInches", event.target.value)} />
                      <small>in</small>
                    </div>
                  </label>
                </>
              ) : (
                <>
                  <label>
                    <span>Weight (kg)</span>
                    <input type="number" min="35" max="275" value={form.weight} onChange={event => patch("weight", event.target.value)} />
                  </label>
                  <label>
                    <span>Height (cm)</span>
                    <input type="number" min="130" max="230" value={form.height} onChange={event => patch("height", event.target.value)} />
                  </label>
                </>
              )}

              <label className="fitFull">
                <span>Activity</span>
                <select value={form.activity} onChange={event => patch("activity", event.target.value)}>
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
            <h1>Simple numbers. Every day.</h1>
            <p className="fitLead">Take a photo of your food and Droxion Fit helps you stay near these targets.</p>
            <div className="fitTargetHero">
              <div><strong>{targets.calories.toLocaleString()}</strong><span>calories / day</span></div>
              <div><strong>{targets.protein}g</strong><span>protein / day</span></div>
            </div>
            <div className="fitTargetMini">
              <div><span>Carbs</span><strong>{targets.carbs}g</strong></div>
              <div><span>Fat</span><strong>{targets.fat}g</strong></div>
              <div><span>Free AI scans</span><strong>{FREE_SCANS}</strong></div>
            </div>
            <div className="fitTrust"><Lock size={16} /><span>Your meal history stays on this device in this first release. Photos are sent only for analysis and are not stored by Droxion Fit.</span></div>
          </>
        )}

        <div className="fitOnboardingActions">
          {step > 0 && <button className="fitGhost" onClick={() => setStep(step - 1)}><ChevronLeft size={18} /> Back</button>}
          <button
            className="fitPrimary"
            onClick={() => step < 2 ? setStep(step + 1) : onComplete({ ...form, targets, createdAt: new Date().toISOString() })}
          >
            {step === 2 ? "Start tracking" : "Continue"} <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </main>
  );
}

function Paywall({ onClose, scansUsed }) {
  return (
    <div className="fitModalBackdrop">
      <section className="fitPaywall">
        <button className="fitIconButton fitClose" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="fitPaywallIcon"><Sparkles size={28} /></div>
        <span className="fitEyebrow">DROXION FIT PRO</span>
        <h2>Make tracking almost effortless.</h2>
        <p>Unlimited AI meal scans, complete history, trends, and future smart coaching.</p>
        <div className="fitBenefits">
          <div><Check size={18} /> Unlimited photo scans</div>
          <div><Check size={18} /> Calories + protein + macros</div>
          <div><Check size={18} /> Progress and meal history</div>
        </div>
        <button className="fitPlan featured">
          <div><strong>Yearly</strong><span>Best value</span></div>
          <b>$39.99/year</b>
        </button>
        <button className="fitPlan">
          <div><strong>Monthly</strong><span>Cancel anytime</span></div>
          <b>$9.99/month</b>
        </button>
        <button className="fitPrimary fitWide" disabled>Store subscription setup next</button>
        <small className="fitPaywallNote">{Math.max(0, FREE_SCANS - scansUsed)} free AI scans remaining. Subscription checkout will be connected to App Store and Google Play products before release.</small>
      </section>
    </div>
  );
}

function Scanner({ scansUsed, onClose, onPaywall, onSave }) {
  const fileRef = useRef(null);
  const [image, setImage] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");

  async function chooseFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (scansUsed >= FREE_SCANS) {
      onPaywall();
      return;
    }

    setError("");
    setAnalysis(null);
    setLoading(true);

    try {
      const prepared = await compressImage(file);
      setImage(prepared);
      const response = await fetch("/api/analyze-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: prepared, hint: hint.trim() })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not analyze this meal.");
      setAnalysis(payload.analysis);
    } catch (err) {
      setError(err?.message || "Could not analyze this meal.");
    } finally {
      setLoading(false);
    }
  }

  function patch(field, value) {
    setAnalysis(current => ({ ...current, [field]: value }));
  }

  return (
    <div className="fitScanner">
      <header className="fitScannerHead">
        <button className="fitIconButton" onClick={onClose}><ChevronLeft size={22} /></button>
        <Brand compact />
        <span className="fitScanQuota">{Math.max(0, FREE_SCANS - scansUsed)} free</span>
      </header>

      {!image && (
        <div className="fitScannerStart">
          <div className="fitCameraOrb"><Camera size={42} /></div>
          <h2>Scan your meal</h2>
          <p>Take one clear photo. We’ll estimate the food, portion, calories, protein, carbs and fat.</p>
          <label>
            <span>Optional context</span>
            <input value={hint} onChange={event => setHint(event.target.value)} placeholder="Example: chicken was 6 oz" />
          </label>
          <button className="fitPrimary fitWide" onClick={() => fileRef.current?.click()}><Camera size={20} /> Take or choose photo</button>
          <input ref={fileRef} hidden type="file" accept="image/*" capture="environment" onChange={chooseFile} />
          <small>Nutrition values are AI estimates. Review portions before saving.</small>
        </div>
      )}

      {image && (
        <div className="fitScanResult">
          <div className="fitMealImage">
            <img src={image} alt="Meal being analyzed" />
            {loading && <div className="fitAnalyzing"><ScanLine size={28} /><strong>Analyzing meal…</strong><span>Finding foods and estimating portions</span></div>}
          </div>

          {error && (
            <div className="fitError">
              <strong>Scan failed</strong>
              <span>{error}</span>
              <button className="fitSecondary" onClick={() => { setImage(""); setError(""); }}>Try another photo</button>
            </div>
          )}

          {analysis && (
            <div className="fitAnalysisCard">
              <div className="fitAnalysisTitle">
                <div>
                  <span className="fitEyebrow">{analysis.confidence || "Estimated"}</span>
                  <input className="fitMealName" value={analysis.name || ""} onChange={event => patch("name", event.target.value)} />
                </div>
                <button className="fitIconButton" onClick={() => { setImage(""); setAnalysis(null); }}><RotateCcw size={18} /></button>
              </div>

              {Array.isArray(analysis.items) && analysis.items.length > 0 && (
                <div className="fitDetected">{analysis.items.join(" · ")}</div>
              )}

              <div className="fitMacroEdit">
                {[
                  ["calories", "Calories", ""],
                  ["protein", "Protein", "g"],
                  ["carbs", "Carbs", "g"],
                  ["fat", "Fat", "g"]
                ].map(([field, label, unit]) => (
                  <label key={field}>
                    <span>{label}</span>
                    <div><input type="number" min="0" value={analysis[field] ?? 0} onChange={event => patch(field, event.target.value)} /><small>{unit}</small></div>
                  </label>
                ))}
              </div>

              <p className="fitEstimateNote">Photo-based nutrition is approximate. Correct anything that looks wrong before logging it.</p>
              <button className="fitPrimary fitWide" onClick={() => onSave({ ...analysis, image })}><Plus size={19} /> Add to today</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Dashboard({ profile, meals, onScan, onOpenPaywall, onReset }) {
  const [tab, setTab] = useState("today");
  const today = dayKey();
  const todayMeals = meals.filter(meal => meal.date === today);
  const totals = sumMeals(todayMeals);
  const targets = profile.targets || calculateTargets(profile);
  const caloriesLeft = Math.max(0, targets.calories - totals.calories);
  const caloriePct = Math.min(100, Math.round((totals.calories / Math.max(1, targets.calories)) * 100));

  const grouped = useMemo(() => {
    const map = new Map();
    meals.forEach(meal => {
      if (!map.has(meal.date)) map.set(meal.date, []);
      map.get(meal.date).push(meal);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [meals]);

  return (
    <main className="fitApp">
      <header className="fitTopbar">
        <Brand compact />
        <button className="fitProPill" onClick={onOpenPaywall}><Sparkles size={15} /> PRO</button>
      </header>

      <div className="fitContent">
        {tab === "today" && (
          <>
            <section className="fitHero">
              <div>
                <span className="fitEyebrow">TODAY</span>
                <h1>{caloriesLeft.toLocaleString()}</h1>
                <p>calories left</p>
              </div>
              <div className="fitRing" style={{ "--pct": caloriePct + "%" }}>
                <div><strong>{Math.round(totals.calories)}</strong><span>eaten</span></div>
              </div>
            </section>

            <section className="fitCard fitMacroCard">
              <MetricBar label="Protein" value={totals.protein} target={targets.protein} unit="g" />
              <div className="fitMacroPair">
                <MetricBar label="Carbs" value={totals.carbs} target={targets.carbs} unit="g" />
                <MetricBar label="Fat" value={totals.fat} target={targets.fat} unit="g" />
              </div>
            </section>

            <button className="fitScanButton" onClick={onScan}>
              <span><Camera size={25} /></span>
              <div><strong>Scan food</strong><small>Photo → calories + protein in seconds</small></div>
              <ChevronRight size={21} />
            </button>

            <section className="fitSection">
              <div className="fitSectionTitle"><h2>Today’s meals</h2><span>{todayMeals.length} logged</span></div>
              {todayMeals.length === 0 ? (
                <div className="fitEmpty">
                  <Utensils size={30} />
                  <strong>No meals yet</strong>
                  <span>Your first scan will show up here.</span>
                </div>
              ) : (
                <div className="fitMealList">
                  {todayMeals.slice().reverse().map(meal => (
                    <article key={meal.id} className="fitMealRow">
                      {meal.image ? <img src={meal.image} alt="" /> : <div className="fitMealFallback"><Utensils size={18} /></div>}
                      <div><strong>{meal.name}</strong><span>{Math.round(meal.protein)}g protein</span></div>
                      <b>{Math.round(meal.calories)} cal</b>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {tab === "history" && (
          <section className="fitSection fitPageSection">
            <span className="fitEyebrow">HISTORY</span>
            <h1>Your meals</h1>
            <p className="fitLead">A clean record of what you logged.</p>
            {grouped.length === 0 ? <div className="fitEmpty"><History size={30} /><strong>Nothing logged yet</strong><span>Scan a meal to start your history.</span></div> : grouped.map(([date, rows]) => {
              const dayTotals = sumMeals(rows);
              return (
                <div key={date} className="fitHistoryDay">
                  <div className="fitHistoryHead"><strong>{date}</strong><span>{Math.round(dayTotals.calories)} cal · {Math.round(dayTotals.protein)}g protein</span></div>
                  {rows.slice().reverse().map(meal => <div className="fitHistoryRow" key={meal.id}><span>{meal.name}</span><b>{Math.round(meal.calories)} cal</b></div>)}
                </div>
              );
            })}
          </section>
        )}

        {tab === "progress" && (
          <section className="fitSection fitPageSection">
            <span className="fitEyebrow">PROGRESS</span>
            <h1>Consistency wins.</h1>
            <p className="fitLead">Keep the daily target obvious instead of drowning in charts.</p>
            <div className="fitStatGrid">
              <div><Flame size={22} /><strong>{Math.min(grouped.length, 999)}</strong><span>days logged</span></div>
              <div><Target size={22} /><strong>{targets.calories}</strong><span>daily calories</span></div>
              <div><Sparkles size={22} /><strong>{targets.protein}g</strong><span>daily protein</span></div>
              <div><LineChart size={22} /><strong>{meals.length}</strong><span>meals tracked</span></div>
            </div>
          </section>
        )}

        {tab === "settings" && (
          <section className="fitSection fitPageSection">
            <span className="fitEyebrow">SETTINGS</span>
            <h1>Droxion Fit</h1>
            <p className="fitLead">AI nutrition estimates for general wellness and fitness tracking.</p>
            <div className="fitSettingsCard">
              <div><span>Goal</span><strong>{profile.goal === "lose" ? "Lose fat" : profile.goal === "gain" ? "Build muscle" : "Maintain"}</strong></div>
              <div><span>Calories</span><strong>{targets.calories}/day</strong></div>
              <div><span>Protein</span><strong>{targets.protein}g/day</strong></div>
            </div>
            <div className="fitLegalLinks"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/support">Support</a></div>
            <button className="fitDanger" onClick={onReset}>Reset local app data</button>
          </section>
        )}
      </div>

      <nav className="fitBottomNav">
        {[
          ["today", Home, "Today"],
          ["history", History, "History"],
          ["scan", ScanLine, "Scan"],
          ["progress", LineChart, "Progress"],
          ["settings", Settings, "Settings"]
        ].map(([id, Icon, label]) => (
          <button
            key={id}
            className={(tab === id ? "active " : "") + (id === "scan" ? "scan" : "")}
            onClick={() => id === "scan" ? onScan() : setTab(id)}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

export default function FitApp() {
  const [profile, setProfile] = useState(() => readJson(PROFILE_KEY, null));
  const [meals, setMeals] = useState(() => readJson(MEALS_KEY, []));
  const [scansUsed, setScansUsed] = useState(() => Number(localStorage.getItem(SCANS_KEY) || 0));
  const [scannerOpen, setScannerOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => writeJson(MEALS_KEY, meals), [meals]);

  function completeOnboarding(nextProfile) {
    writeJson(PROFILE_KEY, nextProfile);
    setProfile(nextProfile);
  }

  function openScanner() {
    if (scansUsed >= FREE_SCANS) {
      setPaywallOpen(true);
      return;
    }
    setScannerOpen(true);
  }

  function saveMeal(analysis) {
    const nextMeal = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      date: dayKey(),
      createdAt: new Date().toISOString(),
      name: String(analysis.name || "Meal"),
      items: Array.isArray(analysis.items) ? analysis.items : [],
      calories: clamp(analysis.calories, 0, 5000),
      protein: clamp(analysis.protein, 0, 500),
      carbs: clamp(analysis.carbs, 0, 700),
      fat: clamp(analysis.fat, 0, 400),
      confidence: String(analysis.confidence || "Estimated"),
      image: analysis.image || ""
    };
    setMeals(current => [...current, nextMeal]);
    const nextScans = scansUsed + 1;
    setScansUsed(nextScans);
    localStorage.setItem(SCANS_KEY, String(nextScans));
    setScannerOpen(false);
  }

  function resetApp() {
    if (!window.confirm("Reset your local Droxion Fit profile and meal history?")) return;
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(MEALS_KEY);
    localStorage.removeItem(SCANS_KEY);
    setMeals([]);
    setScansUsed(0);
    setProfile(null);
  }

  if (!profile) return <Onboarding onComplete={completeOnboarding} />;

  return (
    <>
      <Dashboard
        profile={profile}
        meals={meals}
        onScan={openScanner}
        onOpenPaywall={() => setPaywallOpen(true)}
        onReset={resetApp}
      />
      {scannerOpen && (
        <Scanner
          scansUsed={scansUsed}
          onClose={() => setScannerOpen(false)}
          onPaywall={() => { setScannerOpen(false); setPaywallOpen(true); }}
          onSave={saveMeal}
        />
      )}
      {paywallOpen && <Paywall scansUsed={scansUsed} onClose={() => setPaywallOpen(false)} />}
    </>
  );
}
