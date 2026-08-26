# LIVE control-plane load test

This test is evidence for code-path behavior, not proof of LiveKit or Supabase provider capacity. It opens sharded Supabase Realtime subscriptions across 100 isolated test LIVE sessions and performs initial plus low-frequency authoritative chat, gift, and room-status reads for 10,000 simulated viewers.

## Safety gates

- The script is a dry run unless `DROXION_LOAD_APPROVED=1` is set after founder approval.
- The production Supabase project is refused unless `DROXION_LOAD_ALLOW_PRODUCTION=1` is also explicitly set.
- It performs no gift, wallet, payout, block, chat-send, or viewer-heartbeat writes.
- Use an isolated Supabase/LiveKit environment with disposable users and rooms.

## Distributed run

Provide a newline-delimited room UUID file and test-user JWT file to each runner. Use enough runners to keep each process near 100-250 Realtime clients. For 10,000 viewers, 50 runners at 200 viewers each is a reasonable starting split.

```bash
DROXION_LOAD_APPROVED=1 \
DROXION_LOAD_SUPABASE_URL=https://PROJECT.supabase.co \
DROXION_LOAD_SUPABASE_ANON_KEY=... \
DROXION_LOAD_ROOM_FILE=/secure/rooms.txt \
DROXION_LOAD_TOKEN_FILE=/secure/tokens.txt \
npm run load:live-control-plane -- \
  --rooms 100 --viewers 10000 --duration 900 \
  --shard-index 0 --shard-count 50
```

Ramp through 100, 500, 2,000, 5,000, and 10,000 viewers. Stop if connection errors exceed 1%, authoritative read errors exceed 0.5%, p95 read latency exceeds 1 second for five minutes, database CPU exceeds 70%, Realtime lag exceeds 2 seconds, or provider rate-limit responses appear.

Record subscription success, read success/latency, Realtime delivery lag and duplicates, Postgres CPU/IO/connections, Supabase Realtime concurrent connections/messages, and LiveKit rooms/participants/egress. Run a separate media-plane test with LiveKit tooling and provider approval; this script intentionally does not publish or subscribe to audio/video.

Before claiming readiness, confirm paid-plan quotas and rate limits for at least 100 concurrent LiveKit rooms, 10,000 subscribed participants, Supabase Realtime concurrent connections/channel joins/messages, Postgres connection/CPU/IOPS, Auth request rate, API/RPC throughput, and Vercel function concurrency/egress.
