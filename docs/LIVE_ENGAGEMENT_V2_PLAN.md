# Droxion LIVE Engagement V2

## Objective
Build the next Droxion LIVE engagement layer without destabilizing the currently working camera LIVE experience.

## Non-negotiable freeze
The current camera LIVE path is the protected baseline. Do not refactor or replace these files for engagement work unless a separately reproduced defect requires a minimal fix:

- `src/features/live/hooks/useLiveBroadcast.js`
- `src/features/live/services/liveTransportService.js`
- `src/features/live/services/livePublisherService.js`
- `src/features/live/services/liveMediaService.js`
- `src/features/live/services/liveSessionService.js`
- `src/livekit/livekitRoom.js`

Do not reintroduce `LiveExperienceScale` into the production host/viewer flow.

Engagement features must be implemented as isolated overlays, sidecars, services, and server-authoritative database functions around the working transport.

## Product scope

### Phase 1 - Gift economy
- Expand the active LIVE gift catalog to 25 gifts.
- Organize gifts into clear price/status tiers.
- Add larger coin packs that map naturally to premium gifts.
- Keep balance deduction and creator/platform accounting server-authoritative.
- Add a cinematic asset/presentation configuration per gift.
- Preserve select-then-send UX and insufficient-balance wallet handoff.

### Phase 2 - Cinematic gift presentation
- Small gifts: lightweight non-blocking effects.
- Mid-tier gifts: featured effects.
- Premium/legendary gifts: full cinematic effects.
- Sender name and gift name visible to creator and viewers.
- Effects must never own or mutate LiveKit room, tracks, camera, microphone, heartbeat, or session state.

### Phase 3 - Supporter Spotlight
- Premium gifts can grant time-limited supporter recognition.
- Each supporter has an independent expiration time.
- Multiple active supporters rotate in a compact top-of-LIVE presentation.
- New qualifying gift receives immediate recognition before entering rotation.
- Tapping a supporter opens the user's LIVE profile sheet.
- Spotlight expires when the LIVE ends.

### Phase 4 - Creator Pin
- Creator can pin one viewer/supporter/member at a time.
- Creator pin is separate from paid Supporter Spotlight.
- Pin/unpin is server-authorized for the current LIVE host only.

### Phase 5 - LIVE profile sheets and follow
- Usernames in chat, gifts, supporter UI, pins, and membership events become clickable.
- Open a bottom-sheet profile while LIVE continues playing.
- Support Follow/Following without leaving LIVE.
- Never expose private profile fields in public LIVE payloads.

### Phase 6 - Creator memberships
- Start with a simple creator membership product before adding multiple tiers.
- Member badge and gold/bold chat identity.
- Public new-member celebration event.
- Membership purchases and entitlement checks must be verified server-side.
- Cancellation/expiry/renewal must remove or restore entitlement correctly.

### Phase 7 - Ads
- Insert clearly labeled sponsored items between highlight/reel feed items rather than blank gaps.
- Add LIVE browse ads only at safe browse positions.
- Interstitials only at natural transitions; never unexpectedly cover an active interaction.
- Rewarded ads may grant promotional coins only through a server-authoritative grant path.
- Promotional coins must remain economically distinct from cash-backed creator payout value.

### Phase 8 - Desktop Gaming / Screen LIVE
- Add a separate `Gaming / Screen LIVE` mode.
- Desktop creator can choose screen/window/tab, microphone, and optional webcam.
- Use a dedicated screen-share publishing path; do not modify the proven camera publisher to force screen share into it.
- Gaming LIVE continues to use the same engagement overlays: chat, gifts, supporters, memberships, profiles.

### Phase 9 - OBS / Streamlabs
- Add server URL and revocable stream-key workflow for professional creators.
- Stream keys are secrets and must never be returned to other users, logged in plaintext, or committed to source control.

### Phase 10 - Authentication
- Add Continue with Google.
- Add Sign in with Apple.
- New social-auth users complete required Droxion profile/21+ onboarding once.
- Returning users go directly to the app.
- Prevent accidental duplicate accounts and preserve account recovery/deletion flows.

## Security gates

### Source control
- No production secrets, private keys, service-role tokens, payment secrets, Trolley secrets, Apple secrets, Google secrets, or LiveKit API secrets may be committed.
- Public client identifiers/anon keys must be treated according to provider design; authorization must never rely on their secrecy.
- Environment secrets remain in Vercel/Supabase/Codemagic/App Store/Play configuration as appropriate.

### Supabase
- RLS remains enabled for user-owned/private tables.
- Security-definer RPCs validate `auth.uid()` and ownership/role explicitly.
- No client can choose creator payout amount, platform share, credited coins, membership entitlement, spotlight eligibility, or ad-reward amount.
- Public LIVE reads expose only fields needed by viewers.

### Payments and wallets
- Store/PayPal purchase verification remains server-side.
- Gift balance deduction is atomic and authoritative.
- Creator earnings cannot be minted by the client.
- Withdrawal remains protected by authenticated server endpoints and authoritative wallet state.
- No economic split or payout behavior is changed without explicit founder approval.

### LIVE
- Engagement components never call camera/mic publication controls except through the existing approved host controls.
- Engagement failure must not end LIVE or disconnect a viewer.
- Realtime events are treated as presentation signals; server state remains authoritative for money/entitlements.

### Abuse and moderation
- Blocked users cannot bypass block rules through gifts, chat, follows, profile sheets, memberships, or pins.
- Rate-limit high-frequency mutation endpoints/RPCs where appropriate.
- Validate message text, IDs, quantities, enum values, and ownership server-side.
- Add auditability for gifts, membership entitlements, spotlight grants, promo-coin grants, and payout-impacting events.

## Release gates
Before merging any phase to `main`:
1. Build succeeds.
2. Existing camera LIVE still starts on the host and plays video/audio on another device.
3. Chat still works.
4. Gift/balance regression checks pass.
5. No new client-side secret or privileged credential is introduced.
6. Relevant RLS/RPC authorization is reviewed.
7. Mobile implications are checked.
8. Founder explicitly approves release progression.

## Current branch policy
All V2 work begins on `live-engagement-v2`. `main` remains the production source of truth and is not changed until an isolated phase is reviewed, tested, and intentionally merged.