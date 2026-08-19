# Android launch status

Prepared in code:

- Capacitor Android release build workflow targeting API 36
- Android camera/microphone manifest permissions in release workflow
- Google Play one-time coin product IDs mapped to Droxion products
- Native Google Play product loading and purchase flow in `DroxionWallet`
- Server-side Google Play purchase verification through Android Publisher API
- Idempotent Google Play wallet fulfillment and transaction ledger
- Server-side consumption after successful wallet fulfillment

External setup still required before the first Play test build can complete:

- Google Play Console app for package `com.droxion.live`
- Four activated one-time products
- Google Play / Google Cloud service account with Android Publisher access
- Vercel production variables for the service account email and private key
- Android upload keystore and GitHub Actions signing secrets
- Play Console store listing/compliance forms and tester configuration
