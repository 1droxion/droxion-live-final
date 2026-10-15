// Backport a current-entitlements-only query to the pinned 7.16.0 plugin.
// Never use purchase history as proof that a subscription is still owned.
import fs from 'node:fs';
const root = 'node_modules/@capgo/native-purchases/';
const version = JSON.parse(fs.readFileSync(root + 'package.json')).version;
if (version !== '7.16.0') throw new Error('Review the StoreKit patch before changing native-purchases version.');
const file = root + 'ios/Sources/NativePurchasesPlugin/NativePurchasesPlugin.swift';
const original = 'let allPurchases = await TransactionHelpers.collectAllPurchases(appAccountTokenFilter: appAccountTokenFilter)';
const replacement = `// Droxion: only verified current StoreKit entitlements when requested.
                var allPurchases: [[String: Any]] = []
                if call.getBool("onlyCurrentEntitlements") == true {
                    await TransactionHelpers.collectCurrentEntitlements(appAccountTokenFilter: appAccountTokenFilter, into: &allPurchases)
                } else {
                    allPurchases = await TransactionHelpers.collectAllPurchases(appAccountTokenFilter: appAccountTokenFilter)
                }`;
const source = fs.readFileSync(file, 'utf8');
if (source.includes(replacement)) process.exit(0);
if (source.split(original).length !== 2) throw new Error('Unexpected native purchase implementation; refusing to patch.');
fs.writeFileSync(file, source.replace(original, replacement));
