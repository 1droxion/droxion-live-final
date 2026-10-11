import test from 'node:test';
import assert from 'node:assert/strict';
import { addGrocery, groceryTotal, normalizeProduct, productMeal } from '../src/fit/routine.js';

test('grocery list ignores blank names and deduplicates only items still needed', () => {
  assert.deepEqual(addGrocery([], { name: '  ' }), []);
  const list = addGrocery([], { name: ' Eggs ', quantity: '1 dozen' });
  assert.equal(list[0].name, 'Eggs');
  assert.equal(addGrocery(list, { name: 'eggs' }).length, 1);
  assert.equal(addGrocery([{ ...list[0], done: true }], { name: 'Eggs' }).length, 2);
});
test('budget adds line totals without multiplying quantities or treating missing data as a price', () => {
  assert.equal(groceryTotal([{ price: 5, quantity: '2' }, { price: null }, { price: -3 }, { price: 2.5 }]), 7.5);
});
test('missing product nutrition stays unknown, while actual zero is preserved', () => {
  const product = normalizeProduct({ nutriments: { proteins_100g: 0, sugars_100g: '', salt_100g: -2 } }, '12345678');
  assert.equal(product.protein, 0);
  assert.equal(product.calories, null);
  assert.equal(product.sugar, null);
  assert.equal(product.salt, null);
  assert.throws(() => productMeal(product, 100), /incomplete/);
});
test('a portion scales the per-100g values and invalid amounts cannot be logged', () => {
  const product = { name: 'Oats', calories: 380, protein: 13, carbs: 67, fat: 7 };
  assert.equal(productMeal(product, 50).calories, 190);
  assert.equal(productMeal(product, 50).protein, 6.5);
  for (const value of [0, -1, '', 'bad', 2001]) assert.throws(() => productMeal(product, value), /portion/);
});
