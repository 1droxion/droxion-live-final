# Droxion Android launch

## Google Play app

- Package name: `com.droxion.live`
- App name: `Droxion Live`
- Target SDK: Android 16 / API 36
- Upload format: Android App Bundle (`.aab`)

## One-time coin products

Create these Google Play one-time products using the existing Droxion IDs:

| Product ID | Coins |
| --- | ---: |
| `com.droxion.live.coins100` | 100 |
| `com.droxion.live.coins550` | 550 |
| `com.droxion.live.coins1200` | 1,200 |
| `com.droxion.live.coins3000` | 3,000 |

The database `google_product_id` values already match these IDs.

## Vercel production secrets

The server-side Google Play verifier requires:

- `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY`

Use a Google Cloud service account that has Android Publisher access to the Droxion app in Play Console. Keep the private key only in Vercel environment variables; never commit it.

Existing Supabase production variables must remain available because `/api/google/verify-purchase` authenticates the Droxion user and performs wallet fulfillment server-side.

## GitHub Actions release secrets

The Android release workflow `.github/workflows/android-release.yml` expects:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PAYPAL_CLIENT_ID` (optional for Android-native checkout, but retained for the shared web build)
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

`ANDROID_KEYSTORE_BASE64` must contain the base64-encoded Google Play upload keystore.

## Test before production

1. Create and activate the four one-time products in Play Console.
2. Add license testers / internal testers.
3. Add the Google Play service account credentials to Vercel production.
4. Add Android signing secrets to GitHub Actions.
5. Run **Droxion Android Release** from GitHub Actions to produce `app-release.aab`.
6. Upload the AAB to Play Console Internal testing.
7. Test sign-up/login, 21+ flow, camera, microphone, LIVE, chat, reports/blocks, coin purchase, gift sending, and wallet balance.
8. Confirm each test purchase credits coins once and can be purchased again after consumption.
9. Complete Data Safety, content rating, app access, privacy policy, account deletion, UGC/moderation declarations, screenshots, icon and feature graphic.
10. Promote the tested release to production when Play Console requirements are satisfied.
