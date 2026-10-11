export const ROUTINE_KEY = 'droxion.fit.routine.v1';
export const WORKOUTS = [
  { id: 'gentle', name: 'Easy start', minutes: 6, detail: 'No equipment · gentle movement', exercises: [
    ['March in place', '60 seconds', 'Stand tall and march at a comfortable pace.'],
    ['Chair sit-to-stand', '8 repetitions', 'Use a stable chair against a wall. Stand slowly; use your hands if needed.'],
    ['Wall push-ups', '8 repetitions', 'Place palms on a wall, bend your elbows slowly, then push back.'],
    ['Standing calf raises', '10 repetitions', 'Hold a stable support and lift your heels slowly.'] ] },
  { id: 'strength', name: 'Home basics', minutes: 10, detail: 'No equipment · full body', exercises: [
    ['March in place', '90 seconds', 'Warm up at a comfortable pace.'],
    ['Chair squats', '2 sets of 8', 'Lower to a stable chair and stand. Keep the movement comfortable.'],
    ['Wall push-ups', '2 sets of 8', 'Keep your body straight and move slowly.'],
    ['Standing knee lifts', '2 sets of 10', 'Alternate knees while holding a stable support if needed.'] ] }
];
export function emptyRoutine() { return { groceries: [], budget: 60, sessions: [] }; }
export function addGrocery(items, item) {
  const name = String(item.name || '').trim().slice(0, 100);
  if (!name) return items;
  const existing = items.find(row => !row.done && row.name.toLowerCase() === name.toLowerCase());
  if (existing) return items;
  return [...items, { id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, name, quantity: String(item.quantity || '1').slice(0, 40), price: null, done: false }];
}
export function groceryTotal(items) { return items.reduce((sum, item) => sum + (Number.isFinite(item.price) && item.price >= 0 ? item.price : 0), 0); }
export function normalizeProduct(product, barcode) {
  const n = product.nutriments || {};
  const number = key => n[key] === undefined || n[key] === null || n[key] === '' ? null : Number.isFinite(Number(n[key])) && Number(n[key]) >= 0 ? Number(n[key]) : null;
  return { barcode, name: product.product_name || product.generic_name || `Product ${barcode}`, brand: product.brands || '', ingredients: product.ingredients_text || '', calories: number('energy-kcal_100g'), protein: number('proteins_100g'), carbs: number('carbohydrates_100g'), fat: number('fat_100g'), sugar: number('sugars_100g'), salt: number('salt_100g') };
}
export function productMeal(product, grams) {
  const amount = Number(grams);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 2000) throw new Error('Enter a portion from 1 to 2,000 grams.');
  if (['calories', 'protein', 'carbs', 'fat'].some(key => product[key] == null)) throw new Error('Nutrition is incomplete. Check the package label before logging this product.');
  const result = { name: `${product.name} (${amount}g)`, confidence: 'Package database', note: 'Open Food Facts data; verify against the package label.', items: [] };
  for (const key of ['calories', 'protein', 'carbs', 'fat']) result[key] = Math.round(product[key] * amount / 100 * 10) / 10;
  return result;
}
