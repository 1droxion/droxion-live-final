# Play Console manual steps

1. Create the Droxion Live Android app with package `com.droxion.live`.
2. Create the four one-time products listed in `GOOGLE_PLAY_PRODUCTS.csv`.
3. Link a Google Cloud service account and grant it Android Publisher access for Droxion Live.
4. Put that service account email/private key in Vercel production environment variables.
5. Configure an Android upload key in GitHub Actions secrets.
6. Generate and upload the signed AAB to Internal testing.
7. Add tester accounts and complete a real Play Billing test purchase.
8. Complete store listing, Data Safety, content rating, app access, privacy/account deletion and UGC declarations.
9. Promote the tested build to production once Play Console allows production rollout.
