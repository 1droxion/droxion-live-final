# Droxion Shorts conversion

This branch replaces the active fitness entry point with a short-drama viewer. Bundle ID stays `com.droxion.live`. The working display name is Droxion Shorts, version 1.8. Existing fitness files and subscription endpoints are retained but unused by the drama UI.

## Implemented
- Responsive catalogue, search and genre filters; series details and episode grid.
- Video player with previous/next, autoplay next episode, resume progress, saved list.
- Honest concept catalogue when no real series exists; local video preview is session-only.
- Supabase account sign-in for preprovisioned users and admin role lookup.
- Admin batch MP4 upload, natural filename ordering, rights confirmation and atomic catalogue publishing.
- Private storage with database-enforced free/premium access; short-lived signed playback URLs. All membership controls fail closed; there is no local fake unlock.
- Safe error states, native safe-area spacing, preliminary privacy/terms and clear-local-data action.

## Connect cloud
1. Create a new Supabase project and run `backend/shorts-schema.sql` once. Do not run twice without reconciling existing policies.
2. Create an admin user in Supabase Authentication; insert its auth UUID into `shorts_admins` using SQL editor.
3. Set `VITE_SHORTS_SUPABASE_URL` and `VITE_SHORTS_SUPABASE_ANON_KEY` in Vercel AND Codemagic environments, then rebuild. Keys are public; never use the service-role key.
4. Sign in through Me, select Manage catalogue, add series metadata and MP4 episode files. Filenames like 01.mp4, 02.mp4 define order. Each new series needs a unique slug. Posters use public HTTPS image URLs.
5. Storage plan upload limits apply; large/long episodes need resumable upload or a dedicated streaming service. Batch uploads are sequential. A failed batch may leave orphan private files; remove those in Supabase Storage before retrying. Catalogue publication itself is transactional.
6. Test anonymous free playback, blocked premium playback, admin upload, authenticated membership, expired membership and signed URL refresh after an hour. Configure allowed auth origins and delivery regions before launch.

## Release blockers — not production-ready yet
- Real authorised catalogue and promotional rights. Only concept artwork is bundled.
- Supabase project, account provisioning and operational verification. No cloud credentials are configured by this code change.
- Native store products, store receipt validation tied to a real account, renewal/revocation webhooks, restore purchases, server-issued access, prices and final subscription terms. Existing fitness product IDs MUST NOT be reused as drama products. UI deliberately disables purchases.
- Public sign-up, password recovery, account deletion, final privacy policy and customer support operations.
- Global cross-device watch history (progress/favourites are local to the device).
- Dedicated transcoding/HLS, subtitles, upload retry/resume and catalogue edit/unpublish tooling for daily large-volume publishing.
- New native icon is included. App-store screenshots must be captured from the final configured app.
- Signed iOS/Android builds, device QA and App Store review; a Linux web build is not a verified IPA.

## Validation
Run `npm run build` and `node --test tests/shorts.test.mjs`. Do not submit this build as a finished subscription service until the blockers above are resolved. Use this branch in Codemagic for TestFlight development.
