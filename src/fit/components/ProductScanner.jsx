import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { X, Camera, ShoppingBasket } from 'lucide-react';
import { normalizeProduct, productMeal } from '../routine.js';

export default function ProductScanner({ onClose, onAdd, onLog }) {
  const [barcode, setBarcode] = useState('');
  const [product, setProduct] = useState(null);
  const [grams, setGrams] = useState('100');
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const video = useRef(null);
  const request = useRef(null);
  const added = useRef(false);
  const logged = useRef(false);
  useEffect(() => () => request.current?.abort(), []);

  async function lookup(code) {
    code = code.replace(/[\s-]/g, '');
    setError(''); setNotice(''); setProduct(null); added.current = false; logged.current = false;
    if (!/^\d{8,14}$/.test(code)) { setError('Enter the 8–14 digits printed below the food barcode.'); return; }
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    setBusy(true); setBarcode(code);
    try {
      const fields = 'product_name,generic_name,brands,ingredients_text,nutriments';
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Product lookup is unavailable. Please try again.');
      const data = await response.json();
      if (request.current !== controller) return;
      if (data.status !== 1 || !data.product) throw new Error('Product not found. You can still add its name to your groceries manually.');
      setProduct(normalizeProduct(data.product, code)); setGrams('100');
    } catch (e) {
      if (request.current === controller) setError(e.name === 'AbortError' ? 'Lookup timed out. Check your connection and try again.' : e.message || 'Could not connect. Check your internet connection.');
    } finally { clearTimeout(timeout); if (request.current === controller) setBusy(false); }
  }

  useEffect(() => {
    if (!camera) return;
    let stopped = false;
    let found = false;
    let controls;
    const reader = new BrowserMultiFormatReader();
    reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, video.current, (result, _, activeControls) => {
      if (!result || stopped || found) return;
      found = true; activeControls.stop(); setCamera(false); lookup(result.getText());
    }).then(value => { controls = value; if (stopped) value.stop(); }).catch(() => {
      if (!stopped) { setCamera(false); setError('Camera could not start. Allow camera access, or type the barcode below.'); }
    });
    return () => { stopped = true; controls?.stop(); };
  }, [camera]);

  const nutritionComplete = product && ['calories', 'protein', 'carbs', 'fat'].every(key => product[key] != null);
  return <div className="fitModalBackdrop"><section className="fitMealEditor routineScanner" role="dialog" aria-modal="true" aria-labelledby="productScanTitle">
    <button className="fitIconButton fitClose" onClick={onClose} aria-label="Close product scanner"><X size={20} /></button>
    <span className="fitEyebrow">PACKAGED FOOD</span><h2 id="productScanTitle">Scan a barcode</h2><p className="fitLead">Find nutrition and add food to your grocery list.</p>
    {camera && <div className="routineCamera"><video ref={video} autoPlay playsInline muted /><p>Hold the food barcode steady in view.</p></div>}
    <button className="routineSecondary fitWide" disabled={busy} onClick={() => { setError(''); setCamera(!camera); }}><Camera size={18} /> {camera ? 'Stop camera' : 'Open camera'}</button>
    <form onSubmit={e => { e.preventDefault(); setCamera(false); lookup(barcode); }}><label className="routineField">Barcode digits<input inputMode="numeric" maxLength="20" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Digits below the barcode" /></label><button className="fitPrimary fitWide" disabled={busy}>{busy ? 'Looking up…' : 'Find product'}</button></form>
    {error && <p role="alert" className="fitInlineError">{error}</p>}
    {product && <div className="routineProduct"><span className="fitMuted">{product.brand}</span><h3>{product.name}</h3><p className="fitMuted">Per 100g / 100ml, as recorded in the database</p><div className="routineNutrition">{[['calories','Calories',''],['protein','Protein','g'],['sugar','Sugar','g'],['salt','Salt','g']].map(([key,label,unit]) => <div key={key}><strong>{product[key] == null ? '—' : `${product[key]}${unit}`}</strong><span>{label}</span></div>)}</div>
      {product.ingredients && <details><summary>Ingredients</summary><p>{product.ingredients}</p></details>}
      <button className="fitPrimary fitWide" disabled={added.current} onClick={() => { if (onAdd({ name: product.name, quantity: '1 package' }) !== false) { added.current = true; setNotice('Added to groceries.'); } }}><ShoppingBasket size={18} />{added.current ? 'Added to groceries' : 'Add to groceries'}</button>
      <label className="routineField">Portion (grams, or ml for a liquid)<input type="number" min="1" max="2000" value={grams} onChange={e => setGrams(e.target.value)} /></label>
      <button className="routineSecondary fitWide" disabled={!nutritionComplete || logged.current} onClick={() => { try { onLog(productMeal(product, grams)); logged.current = true; setNotice('Added to today’s meals.'); } catch (e) { setError(e.message); } }}>{logged.current ? 'Meal logged' : 'Log this portion'}</button>
      {!nutritionComplete && <p className="fitMuted">Nutrition is incomplete, so logging is unavailable. Verify the package label.</p>}
    </div>}
    {notice && <p role="status" className="routineNotice">{notice}</p>}
    <p className="fitMuted">Database entries may be missing or inaccurate. Check the package label, especially for allergens.</p><a className="routineSource" href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Data: Open Food Facts · ODbL</a>
  </section></div>;
}
