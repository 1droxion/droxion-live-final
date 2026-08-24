# Droxion Live Agent Operating Rules

This repository is production software for Droxion Live. Agents may implement, test, review, and prepare releases, but they must follow these rules.

## Primary goal
Keep Droxion LIVE reliable first. A user must be able to start a LIVE on one phone and watch it from another phone before lower-priority work is considered complete.

## Standard engineering loop
1. Read the existing code and current production behavior before changing anything.
2. Make the smallest safe fix that solves the observed problem.
3. Run `npm install --no-audit --no-fund` when dependencies changed and run `npm run build` before release preparation.
4. Check native implications. Capacitor bundles `dist`, so a web fix does not update an already-installed iOS/Android app until a native build is produced.
5. Never claim a bug is fixed until the relevant build/deployment completed successfully and the available evidence supports it.

## Release policy
- `main` is the source of truth for approved engineering changes.
- iOS release builds are prepared through the existing Codemagic integration and App Store Connect/TestFlight pipeline defined in `codemagic.yaml`.
- Do not assume a separate release branch is required unless the repository or Codemagic configuration explicitly adds one later.
- TestFlight upload may be automatic after a successful signed iOS build.
- Final App Store production release remains a human approval step for the founder.
- When checking release status, use available evidence from GitHub/Codemagic/App Store Connect/TestFlight or connected email; do not infer that a build is absent only because GitHub has no artifact.

## Apple rejection / review loop
When an App Store Connect or App Review message is received:
1. Read the exact Apple message and identify the guideline or information request.
2. Reproduce or inspect the affected flow in the repository.
3. Fix the minimum necessary code/configuration/review-note issue.
4. Run the quality gate/build again.
5. Prepare a new TestFlight build.
6. Prepare a concise factual response to Apple describing exactly what changed.
7. Do not misrepresent functionality, demo credentials, privacy behavior, payments, moderation, or age restrictions.
8. Do not release to production without founder approval.

## High-risk areas requiring human approval
Agents may investigate and propose/fix code, but must not autonomously make irreversible production decisions involving:
- user balances, creator payouts, withdrawals, refunds, or revenue-share accounting;
- destructive database migrations or deletion of production user data;
- weakening Supabase RLS, authentication, payment validation, moderation, or abuse protections;
- legal/privacy representations, tax decisions, contracts, or regulatory filings;
- final App Store / Play Store production release.

## Droxion-specific QA checklist
Before moving an iOS release forward, verify as much as the available environment allows:
- sign up / sign in / sign out;
- Home loads active LIVEs;
- Phone A can start LIVE and Phone B can receive video/audio;
- join request can be accepted and declined; after decline the requester cannot immediately request again for that same LIVE;
- chat and follow state do not break LIVE;
- gifts do not alter balances outside validated backend logic;
- highlight/Short share works;
- highlight/Short download uses the native-safe path on iOS;
- build succeeds with no blocking console/build errors.

## Agent team responsibilities
- Engineering agent: code, LiveKit, Supabase integration, frontend/native fixes.
- QA agent: regression checks and release checklist.
- Security agent: RLS, auth, payments/balances, abuse review.
- Release agent: quality gate, Codemagic/TestFlight status, Apple review triage.

The founder owns product direction, pricing/economics, major partnerships, fundraising, and final production-release approval.
