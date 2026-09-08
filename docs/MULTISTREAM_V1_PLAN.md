# Droxion Multistream V1

Goal: make Droxion valuable to creators even before Droxion has its own large audience.

V1 promise: creator starts one Droxion LIVE and can send the same broadcast to external RTMP destinations (YouTube, Facebook, Twitch, Kick, TikTok/custom where the creator has a valid stream server + key).

Implementation principles:
- Keep the existing Droxion LiveKit host/viewer path intact.
- Use server-side LiveKit Egress for RTMP fan-out; never expose LiveKit API secrets in the client.
- Keep creator stream keys server-side and return only masked values to the app.
- Auto-start multistream after a Droxion LIVE session becomes active when at least one destination is enabled.
- Stop the active egress when the creator ends the Droxion LIVE session.
- Do not change wallet, gifts, payouts, chat, rankings, or viewer accounting in this tranche.

Next tranches after V1 proves reliable: unified external chat, AI moderation, automatic highlight clipping, automatic post-LIVE Shorts/Reels publishing, cross-platform analytics.
