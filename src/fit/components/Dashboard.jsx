import { useMemo, useState } from "react";
import {
  Camera,
  ChevronRight,
  Flame,
  History,
  Home,
  LineChart,
  ScanLine,
  Settings,
  Sparkles,
  Target,
  Trash2,
  Utensils,
  X
} from "lucide-react";
import { dayKey, goalLabel, lastSevenDays, sumMeals } from "../nutrition.js";

function Brand() {
  return (
    <div className="fitBrand compact">
      <div className="fitBrandMark"><ScanLine size={18} strokeWidth={2.5} /></div>
      <strong>Droxion Fit</strong>
    </div>
  );
}

function MetricBar({ label, value, target, unit }) {
  const pct = Math.min(100, Math.round((Number(value || 0) / Math.max(1, Number(target || 1))) * 100));
  return (
    <div className="fitMetric">
      <div className="fitMetricRow"><span>{label}</span><strong>{Math.round(value)} / {target}{unit}</strong></div>
      <div className="fitBar"><span style={{ width: pct + "%" }} /></div>
    </div>
  );
}

function MealEditor({ meal, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState({ ...meal });
  const fields = [
    ["calories", "Calories", ""],
    ["protein", "Protein", "g"],
    ["carbs", "Carbs", "g"],
    ["fat", "Fat", "g"]
  ];

  return (
    <div className="fitModalBackdrop">
      <section className="fitMealEditor">
        <button type="button" className="fitIconButton fitClose" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <span className="fitEyebrow">EDIT MEAL</span>
        <input className="fitMealName" value={draft.name || ""} onChange={e => setDraft({ ...draft, name: e.target.value })} />
        <div className="fitMacroEdit">
          {fields.map(([field,label,unit]) => (
            <label key={field}>
              <span>{label}</span>
              <div>
                <input inputMode="decimal" type="number" min="0" value={draft[field] ?? 0} onChange={e => setDraft({ ...draft, [field]: e.target.value })} />
                <small>{unit}</small>
              </div>
            </label>
          ))}
        </div>
        <button type="button" className="fitPrimary fitWide" onClick={() => onSave(draft)}>Save changes</button>
        <button type="button" className="fitDanger fitWide" onClick={() => onDelete(meal.id)}><Trash2 size={17} /> Delete meal</button>
      </section>
    </div>
  );
}

export default function Dashboard({
  profile,
  meals,
  freeRemaining,
  pro,
  onScan,
  onOpenPaywall,
  onReset,
  onUpdateMeal,
  onDeleteMeal
}) {
  const [tab, setTab] = useState("today");
  const [editing, setEditing] = useState(null);
  const today = dayKey();
  const todayMeals = meals.filter(meal => meal.date === today);
  const totals = sumMeals(todayMeals);
  const targets = profile.targets;
  const caloriesLeft = Math.max(0, targets.calories - totals.calories);
  const proteinLeft = Math.max(0, targets.protein - totals.protein);
  const caloriePct = Math.min(100, Math.round((totals.calories / Math.max(1, targets.calories)) * 100));
  const week = useMemo(() => lastSevenDays(meals), [meals]);

  const grouped = useMemo(() => {
    const map = new Map();
    meals.forEach(meal => {
      if (!map.has(meal.date)) map.set(meal.date, []);
      map.get(meal.date).push(meal);
    });
    return Array.from(map.entries()).sort((a,b) => b[0].localeCompare(a[0]));
  }, [meals]);

  const loggedDays = grouped.length;
  const hitProteinDays = week.filter(day => day.totals.protein >= targets.protein * 0.9).length;

  return (
    <main className="fitApp">
      <header className="fitTopbar">
        <Brand />
        <button type="button" className={"fitProPill" + (pro ? " active" : "")} onClick={onOpenPaywall}>
          <Sparkles size={15} /> {pro ? "PRO" : freeRemaining + " FREE"}
        </button>
      </header>

      <div className="fitContent">
        {tab === "today" && (
          <>
            <section className="fitHero">
              <div>
                <span className="fitEyebrow">TODAY</span>
                <h1>{caloriesLeft.toLocaleString()}</h1>
                <p>calories left · <strong>{Math.round(proteinLeft)}g protein left</strong></p>
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

            <button type="button" className="fitScanButton" onClick={onScan}>
              <span><Camera size={25} /></span>
              <div><strong>Scan food</strong><small>Photo → calories + protein in seconds</small></div>
              <ChevronRight size={21} />
            </button>

            <section className="fitSection">
              <div className="fitSectionTitle"><h2>Today’s meals</h2><span>{todayMeals.length} logged</span></div>
              {todayMeals.length === 0 ? (
                <div className="fitEmpty"><Utensils size={30} /><strong>No meals yet</strong><span>Your first scan will appear here.</span></div>
              ) : (
                <div className="fitMealList">
                  {todayMeals.slice().reverse().map(meal => (
                    <button type="button" key={meal.id} className="fitMealRow" onClick={() => setEditing(meal)}>
                      {meal.image ? <img src={meal.image} alt="" /> : <span className="fitMealFallback"><Utensils size={18} /></span>}
                      <div><strong>{meal.name}</strong><span>{Math.round(meal.protein)}g protein</span></div>
                      <b>{Math.round(meal.calories)} cal</b>
                    </button>
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
            <p className="fitLead">Tap any meal to correct or delete it.</p>
            {grouped.length === 0 ? (
              <div className="fitEmpty"><History size={30} /><strong>Nothing logged yet</strong><span>Scan a meal to start your history.</span></div>
            ) : grouped.map(([date, rows]) => {
              const dayTotals = sumMeals(rows);
              return (
                <div key={date} className="fitHistoryDay">
                  <div className="fitHistoryHead"><strong>{date}</strong><span>{Math.round(dayTotals.calories)} cal · {Math.round(dayTotals.protein)}g protein</span></div>
                  {rows.slice().reverse().map(meal => (
                    <button type="button" className="fitHistoryRow" key={meal.id} onClick={() => setEditing(meal)}>
                      <span>{meal.name}</span><b>{Math.round(meal.calories)} cal</b>
                    </button>
                  ))}
                </div>
              );
            })}
          </section>
        )}

        {tab === "progress" && (
          <section className="fitSection fitPageSection">
            <span className="fitEyebrow">PROGRESS</span>
            <h1>Consistency over perfection.</h1>
            <p className="fitLead">Your last seven days at a glance.</p>
            <div className="fitWeekChart">
              {week.map(day => {
                const pct = Math.min(100, Math.round(day.totals.calories / Math.max(1, targets.calories) * 100));
                return <div key={day.key}><span><i style={{ height: pct + "%" }} /></span><small>{day.label}</small></div>;
              })}
            </div>
            <div className="fitStatGrid">
              <div><Flame size={22} /><strong>{loggedDays}</strong><span>days logged</span></div>
              <div><Target size={22} /><strong>{hitProteinDays}/7</strong><span>protein days</span></div>
              <div><Sparkles size={22} /><strong>{targets.protein}g</strong><span>protein target</span></div>
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
              <div><span>Goal</span><strong>{goalLabel(profile.goal)}</strong></div>
              <div><span>Calories</span><strong>{targets.calories}/day</strong></div>
              <div><span>Protein</span><strong>{targets.protein}g/day</strong></div>
              <div><span>Plan</span><strong>{pro ? "Pro" : "Free"}</strong></div>
            </div>
            {!pro && <button type="button" className="fitPrimary fitWide fitSettingsUpgrade" onClick={onOpenPaywall}>Upgrade to Pro</button>}
            <div className="fitLegalLinks"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/support">Support</a></div>
            <button type="button" className="fitDanger fitWide" onClick={onReset}>Reset local meal data</button>
          </section>
        )}
      </div>

      <nav className="fitBottomNav" aria-label="Main navigation">
        {[
          ["today", Home, "Today"],
          ["history", History, "History"],
          ["scan", ScanLine, "Scan"],
          ["progress", LineChart, "Progress"],
          ["settings", Settings, "Settings"]
        ].map(([id, Icon, label]) => (
          <button
            type="button"
            key={id}
            className={(tab === id ? "active " : "") + (id === "scan" ? "scan" : "")}
            onClick={() => id === "scan" ? onScan() : setTab(id)}
          >
            <Icon size={21} /><span>{label}</span>
          </button>
        ))}
      </nav>

      {editing && (
        <MealEditor
          meal={editing}
          onClose={() => setEditing(null)}
          onSave={meal => { onUpdateMeal(meal); setEditing(null); }}
          onDelete={id => { onDeleteMeal(id); setEditing(null); }}
        />
      )}
    </main>
  );
}
