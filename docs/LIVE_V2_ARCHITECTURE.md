# Droxion LIVE V2 architecture

## Goal

Replace the legacy LIVE startup orchestration with a small, observable pipeline that can be tested independently from Home, feed, chat, gifts, ranking and guest requests.

## Host pipeline

1. Browser opens camera + microphone.
2. Client creates a UUID session ID.
3. `droxion_start_live_v2` persists that exact session ID.
4. Client confirms the persisted session if the RPC response is delayed.
5. `livekit-token` issues a host token.
6. LiveKit room connects with a hard timeout.
7. Camera + microphone publish with a hard timeout.
8. State becomes `live`.
9. Heartbeat runs every 12 seconds.
10. End LIVE disconnects LiveKit, clears media, and calls `droxion_set_live(false)`.

## Viewer pipeline

1. Viewer route receives the session ID.
2. `droxion_live_room_status` verifies the room is active.
3. `livekit-token` issues a viewer token.
4. Viewer connects and subscribes to remote camera + microphone tracks.
5. UI renders tracks directly through LiveKit's attach/detach API.

## State machine

`idle -> preview -> starting -> connecting -> live -> ending -> idle`

Connection recovery can temporarily move `live -> reconnecting -> live`. Any unrecoverable failure moves to `error`.

## Rollout

LIVE V2 remains behind explicit test routes until it passes repeated real-device tests. After transport is stable, legacy LIVE features are added back one layer at a time: discovery, chat, gifts, guest join, ranking/highlights.
