import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import { selectAppleEntitlement } from '../src/fit/apple-entitlements.js';
import { PLAN_IDS } from '../src/fit/constants.js';
const active = { productIdentifier: PLAN_IDS.monthly.productId, transactionId: '42', productType: 'subs', isActive: true, expirationDate: new Date(Date.now() + 3600000).toISOString() };

test('Apple selection rejects expired, refunded, upgraded, unknown and malformed transactions', () => {
  for (const override of [{expirationDate:'2020-01-01'}, {revocationDate:'2026-01-01'}, {isUpgraded:true}, {isActive:false}, {productIdentifier:'other'}, {expirationDate:'invalid'}, {transactionId:''}, {productType:'inapp'}]) {
    assert.equal(selectAppleEntitlement([{...active,...override}]), null);
  }
  // Turning off auto-renewal keeps paid access through expiry.
  assert.equal(selectAppleEntitlement([{...active,willCancel:true}]).active, true);
});

async function storeHarness({purchases=[active], queryError, purchaseError, productResponses=[{products:[{identifier: PLAN_IDS.monthly.productId, priceString: "$4.99"}]}], productTimeout=false}={}) {
  let saved, cleared=false, finished=false;
  const calls=[];
  const native={
    isBillingSupported:async()=>({isBillingSupported:true}),
    getProducts:async options=>{calls.push(["products",options]);if(productTimeout)return new Promise(()=>{});const result=productResponses.length>1?productResponses.shift():productResponses[0];if(result instanceof Error)throw result;return result;},
    purchaseProduct:async options=>{calls.push(['purchase',options]);if(purchaseError)throw purchaseError;return active;},
    getPurchases:async options=>{calls.push(['query',options]);if(queryError)throw queryError;return {purchases};},
    restorePurchases:async()=>calls.push(['restore']),
    acknowledgePurchase:async()=>{finished=true;},
  };
  const context=vm.createContext({console, setTimeout: (fn, ms) => setTimeout(fn, productTimeout ? 0 : ms), clearTimeout});
  const module=new vm.SourceTextModule(await fs.readFile(new URL('../src/fit/store.js',import.meta.url),'utf8'),{context});
  const mocks={
    '@capacitor/core':{Capacitor:{getPlatform:()=> 'ios'}},
    '@capgo/native-purchases':{NativePurchases:native,PURCHASE_TYPE:{SUBS:'subs'}},
    './constants.js':{PLAN_IDS},
    './apple-entitlements.js':{selectAppleEntitlement},
    './storage.js':{getInstallId:()=> '12345678-1234-4234-8234-123456789012',setEntitlement:(token,meta)=>{saved={token,meta};},clearEntitlement:()=>{cleared=true;}},
    './api.js':{ensureInstallToken:()=>{throw Error('Unexpected Vercel call');},verifyStoreSubscription:()=>{throw Error('Unexpected Vercel call');}}
  };
  await module.link(specifier=>{
    const values=mocks[specifier];assert.ok(values,specifier);
    return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);},{context});
  });
  await module.evaluate();
  return {api:module.namespace,calls,state:()=>({saved,cleared,finished})};
}

test('iPhone purchase unlocks only after native current-entitlement verification, without Vercel',async()=>{
  const h=await storeHarness();const result=await h.api.purchasePlan('monthly');
  assert.equal(result.verification,'storekit');
  assert.equal(h.calls[1][1].onlyCurrentEntitlements,true);
  assert.equal(h.state().saved.token,'');
  assert.equal(h.state().finished,true);
});
test('Restore uses Apple account ownership, without filtering to an installation UUID',async()=>{
  const h=await storeHarness();await h.api.restorePro();
  assert.equal(h.calls[0][0],'restore');
  assert.equal(h.calls[1][1].appAccountToken,undefined);
  assert.equal(h.state().saved.meta.active,true);
});
test('No entitlement clears Plus instead of trusting purchase history or cache',async()=>{
  const h=await storeHarness({purchases:[]});assert.equal(await h.api.restorePro(),null);assert.equal(h.state().cleared,true);
});
test('Apple query failure does not overwrite last verified access or unlock new access',async()=>{
  const h=await storeHarness({queryError:Error('Store offline')});await assert.rejects(h.api.refreshAppleEntitlement(),/Store offline/);
  assert.equal(h.state().saved,undefined);assert.equal(h.state().cleared,false);
});
test('Pending or cancelled purchase does not unlock Plus',async()=>{
  for(const message of ['Purchase pending','User cancelled']){
    const h=await storeHarness({purchaseError:Error(message)});await assert.rejects(h.api.purchasePlan('monthly'));
    assert.equal(h.state().saved,undefined);assert.equal(h.calls.length,1);
  }
});
test('Native query is patched to current verified StoreKit entitlements',async()=>{
  const swift=await fs.readFile('node_modules/@capgo/native-purchases/ios/Sources/NativePurchasesPlugin/NativePurchasesPlugin.swift','utf8');
  assert.match(swift,/if call.getBool\("onlyCurrentEntitlements"\) == true \{\s*await TransactionHelpers.collectCurrentEntitlements/);
  const helper=await fs.readFile('node_modules/@capgo/native-purchases/ios/Sources/NativePurchasesPlugin/TransactionHelpers.swift','utf8');
  assert.match(helper,/for await result in Transaction.currentEntitlements \{\s*guard case .verified\(let transaction\) = result else/);
});


test('store loads only configured monthly SKU using localized StoreKit price',async()=>{
  const h=await storeHarness({productResponses:[{products:[{identifier:PLAN_IDS.monthly.productId,priceString:'€5,99'}]}]});
  const products=await h.api.loadSubscriptionProducts();
  assert.equal(products.length,1);assert.equal(products[0].priceString,'€5,99');
  assert.deepEqual(Array.from(h.calls[0][1].productIdentifiers),[PLAN_IDS.monthly.productId]);
});
test('empty product catalogue fails clearly and can recover on the next load',async()=>{
  const h=await storeHarness({productResponses:[{products:[]},{products:[{identifier:PLAN_IDS.monthly.productId,priceString:'$4.99'}]}]});
  await assert.rejects(h.api.loadSubscriptionProducts(),/could not load/);
  const products=await h.api.loadSubscriptionProducts();assert.equal(products[0].priceString,'$4.99');
  assert.equal(h.state().saved,undefined);assert.equal(h.calls.some(([kind])=>kind==='purchase'),false);
});
test('price-query connection error can be retried without starting a purchase',async()=>{
  const h=await storeHarness({productResponses:[Error('Load failed'),{products:[{identifier:PLAN_IDS.monthly.productId,priceString:'$4.99'}]}]});
  await assert.rejects(h.api.loadSubscriptionProducts(),/Load failed/);
  assert.equal((await h.api.loadSubscriptionProducts()).length,1);
  assert.equal(h.calls.some(([kind])=>kind==='purchase'),false);
});
test('a stalled product request times out instead of leaving prices loading forever',async()=>{
  const h=await storeHarness({productTimeout:true});
  await assert.rejects(h.api.loadSubscriptionProducts(),/taking too long/);
  assert.equal(h.state().saved,undefined);
});
