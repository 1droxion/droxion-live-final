# Droxion Live — Apple In-App Purchase setup

Bundle ID: `com.droxion.live`

Create these four **Consumable** In-App Purchases in App Store Connect. Product IDs are permanent, so use them exactly as written.

| Droxion pack | Apple Product ID | Intended US price |
|---|---|---:|
| 100 Coins | `com.droxion.live.coins100` | $1.99 |
| 550 Coins | `com.droxion.live.coins550` | $7.99 |
| 1,200 Coins | `com.droxion.live.coins1200` | $14.99 |
| 3,000 Coins | `com.droxion.live.coins3000` | $29.99 |

For each product:

1. App Store Connect → Droxion Live → Monetization → In-App Purchases.
2. Create a new **Consumable**.
3. Use the exact Product ID above.
4. Add English (U.S.) localization with the pack name and a short description such as `Droxion Coins for LIVE virtual gifts.`
5. Choose the matching price point for the intended US price.
6. Add the required review screenshot after the new TestFlight build shows the wallet purchase screen.
7. Leave the product available for sale and submit the IAP with the app version when the final build is ready.

## App implementation

- iOS uses StoreKit 2 through `@capgo/native-purchases`.
- Prices shown in the iPhone wallet come from Apple StoreKit, not hardcoded app prices.
- The authenticated Supabase user UUID is passed as StoreKit `appAccountToken`.
- The client does not grant coins by itself.
- `/api/apple/verify-purchase` validates the Apple receipt, bundle ID, product ID and transaction ID before server-side fulfillment.
- `droxion_apple_transactions.transaction_id` is unique, so the same Apple transaction cannot credit coins twice.
- The database maps Apple Product IDs to the existing Droxion coin packs and grants the server-configured coin amount.

## Sandbox test

Create an App Store Connect Sandbox Tester, install the latest TestFlight build, open Droxion Wallet, purchase a small coin pack, confirm the coin balance increases once, then use those coins to send a LIVE gift.
