import { useState } from 'react';
import { ShoppingBasket, Dumbbell, Trash2, Plus, Check, ArrowRight } from 'lucide-react';
import { WORKOUTS, groceryTotal } from '../routine.js';
import { dayKey } from '../nutrition.js';

export function Groceries({ routine, onChange, onAdd, onScan }) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notice, setNotice] = useState('');
  const total = groceryTotal(routine.groceries);
  const remaining = routine.groceries.filter(row => !row.done).length;
  async function share() {
    const text = 'Droxion grocery list\n' + routine.groceries.filter(row => !row.done).map(row => `${row.name} — ${row.quantity}`).join('\n');
    try {
      if (navigator.share) await navigator.share({ title: 'My groceries', text });
      else { await navigator.clipboard.writeText(text); setNotice('List copied.'); }
    } catch (error) { if (error.name !== 'AbortError') setNotice('Sharing is unavailable on this device.'); }
  }
  return <section className="fitSection fitPageSection">
    <span className="fitEyebrow">SHOP YOUR WEEK</span><h1>Your groceries.</h1><p className="fitLead">One list for your meals. Check items off as you shop.</p>
    <div className="routineBudget fitCard"><label>Weekly budget ($)<input type="number" min="0" max="10000" value={routine.budget} onChange={e => onChange({ ...routine, budget: Math.min(10000, Math.max(0, Number(e.target.value) || 0)) })} /></label><div><strong>${total.toFixed(2)}</strong><span>of ${routine.budget} entered prices</span></div></div>
    <p className="fitMuted">Enter each line’s total price, including its quantity. Missing prices are excluded.{total > routine.budget ? ' Your entered total is over budget.' : ''}</p>
    <form className="routineAdd" onSubmit={e => { e.preventDefault(); if (name.trim()) { onAdd({ name, quantity }); setName(''); setQuantity('1'); } }}>
      <label>Item<input required maxLength="100" placeholder="Eggs, oats, rice…" value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Quantity<input maxLength="40" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="1 dozen" /></label>
      <button className="fitPrimary" aria-label="Add grocery item"><Plus size={20} /></button>
    </form>
    <div className="routineActions"><button className="routineSecondary" onClick={onScan}>Scan a product</button><button className="routineSecondary" disabled={!remaining} onClick={share}>Share list</button></div>
    {notice && <p role="status" className="fitMuted">{notice}</p>}
    {!routine.groceries.length && <div className="fitEmpty"><ShoppingBasket size={30} /><strong>Your list is ready to start</strong><span>Add an item or scan packaged food.</span></div>}
    <div className="routineList">{routine.groceries.map(row => <div className={'routineRow' + (row.done ? ' checked' : '')} key={row.id}>
      <button className="routineCheck" aria-label={`Mark ${row.name} ${row.done ? 'needed' : 'bought'}`} aria-pressed={row.done} onClick={() => onChange({ ...routine, groceries: routine.groceries.map(item => item.id === row.id ? { ...item, done: !item.done } : item) })}>{row.done && <Check size={17} />}</button>
      <div className="routineItem"><strong>{row.name}</strong><span>{row.quantity}</span></div>
      <label className="routinePrice"><span className="srOnly">Total price for {row.name}</span>$<input type="number" min="0" max="10000" step="0.01" placeholder="—" value={row.price ?? ''} onChange={e => onChange({ ...routine, groceries: routine.groceries.map(item => item.id === row.id ? { ...item, price: e.target.value === '' ? null : Math.min(10000, Math.max(0, Number(e.target.value) || 0)) } : item) })} /></label>
      <button className="fitIconButton" aria-label={`Remove ${row.name}`} onClick={() => onChange({ ...routine, groceries: routine.groceries.filter(item => item.id !== row.id) })}><Trash2 size={16} /></button>
    </div>)}</div>
    {!!routine.groceries.some(row => row.done) && <button className="routineSecondary" onClick={() => onChange({ ...routine, groceries: routine.groceries.filter(row => !row.done) })}>Clear bought items</button>}
    <p className="fitMuted">{remaining} items left · Saved on this device</p>
  </section>;
}

export function Workouts({ routine, onChange }) {
  const [selected, setSelected] = useState(null);
  const [completed, setCompleted] = useState([]);
  const today = dayKey();
  const todayDone = routine.sessions.filter(s => s.date === today);
  function finish() {
    const saved = onChange({ ...routine, sessions: [...routine.sessions, { id: `${Date.now()}`, date: today, workout: selected.id, name: selected.name }].slice(-365) });
    if (saved !== false) { setSelected(null); setCompleted([]); }
  }
  return <section className="fitSection fitPageSection"><span className="fitEyebrow">MOVE A LITTLE, EVERY DAY</span><h1>Your home workout.</h1><p className="fitLead">Simple beginner routines. Choose a comfortable pace.</p>
    <div className="routineSummary fitCard"><Dumbbell size={24} /><div><strong>{todayDone.length ? 'You moved today.' : 'A small start counts.'}</strong><span>{routine.sessions.length} sessions completed</span></div></div>
    {selected ? <div className="fitCard routineWorkout"><h2>{selected.name}</h2><p className="fitMuted">Allow about {selected.minutes} minutes, including rests. Rest 30–60 seconds between sets; take longer as needed.</p>
      {selected.exercises.map(([name, reps, detail], i) => <label className="routineExercise" key={name}><input type="checkbox" checked={completed.includes(i)} onChange={e => setCompleted(e.target.checked ? [...completed, i] : completed.filter(n => n !== i))} /><div><strong>{name}</strong><b>{reps}</b><p>{detail}</p></div></label>)}
      <button className="fitPrimary fitWide" disabled={completed.length !== selected.exercises.length} onClick={finish}>Finish workout</button><button className="routineSecondary fitWide" onClick={() => { setSelected(null); setCompleted([]); }}>Back to routines</button>
    </div> : WORKOUTS.map(workout => <button className="routineWorkoutChoice" key={workout.id} onClick={() => { setSelected(workout); setCompleted([]); }}><div><strong>{workout.name}</strong><span>{workout.detail}</span></div><b>~{workout.minutes} min</b><ArrowRight size={18} /></button>)}
    <p className="fitMuted">Stop if movement causes pain, dizziness, or unusual shortness of breath. These routines are general fitness guidance.</p>
    <a className="routineSource" href="https://www.nhs.uk/live-well/exercise/strength-and-flex-exercise-plan/strength-exercises/" target="_blank" rel="noreferrer">Exercise guidance: NHS strength exercises</a>
    {!!routine.sessions.length && <div className="fitSection"><h2>Recent sessions</h2>{routine.sessions.slice(-7).reverse().map(s => <div className="fitHistoryRow" key={s.id}><span>{s.name}</span><span>{s.date}</span></div>)}</div>}
  </section>;
}
