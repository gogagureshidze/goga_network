# Call credentials and staging checks

Direct calls use native WebRTC. Socket.IO carries authenticated invitations and SDP/ICE/media-state signaling, never live audio/video bytes. Each accepted participant binds to one device identifier. Every credential request checks current conversation membership, both-direction blocks, JOINED state, active call expiry and accepted device. The authenticated server selects the sender and room; clients cannot nominate arbitrary identities.

`GET /api/calls/:id/ice?deviceId=...` returns configured STUN/TURN servers. TURN credentials use coturn's expiring HMAC-SHA1 convention, an opaque identity digest and random nonce. The static secret stays server-side. The browser refreshes before expiration, queues an ICE restart until signaling is ready and buffers candidates by ICE generation. Without TURN, restrictive NAT/firewalls may prevent calls; the UI reports missing relay configuration. See [TURN-VALIDATION.md](TURN-VALIDATION.md).

`POST /api/calls/:id/token` requires same-origin JSON of at most 1 KB: `{deviceId,media:'main'|'screen',leaseId?}`. Omitting media retains the old main-token contract. Tokens initially last 30 seconds and bind the authenticated identity to a server-created room. Main rooms permit only microphone/camera sources. Screen tokens permit screen video/audio only for the holder of the current database lease; others are subscribe-only. Data publishing, room administration, recording, ingress and own-metadata changes are denied. The server verifies a maximum of three participants at the SFU before issuing credentials. Both routes use a bounded per-account 30 requests/minute process-local budget.

`LIVEKIT_URL` must use WSS in production. Only loopback WS is accepted outside production. Signing keys, shared TURN secret and server SDK stay server-side. Provider API requests have a five-second deadline and no automatic failover. Cleanup failures are sanitized and persisted for retry; they do not delay committed call-state publication.

Group admission requires both `ENABLE_GROUP_CALLS=true` and `GROUP_CALL_SECURITY_REVIEWED=true`, plus a configured media control client. These flags remain false by default. They record a reviewed rollout, not a substitute for testing.

## Self-hosted token boundary

LiveKit proactively refreshes connected clients' tokens. A short initial TTL does not invalidate cached/refreshed tokens on self-hosted servers. This implementation uses fresh room names for every screen lease and rotates the main room whenever a joined group participant leaves/is removed. Remaining clients reconnect to the new epoch; previous tokens cannot enter it. Retired-room deletion is durable and retried, with tombstones retained longer than refreshed-token lifetime.

The signed Clerk deletion webhook invokes an internal transaction that locks the account, retires/rotates calls and then deletes the account, so participant cascades cannot erase revocation evidence. This helper is never registered as a socket event. Signature failures and invalid IDs fail before mutation; restrictive foreign-key or deadlock failures roll back and return HTTP 500 for retry. Cross-process clients reconcile call state every five seconds, and the persistent Socket.IO sweeper retries cleanup even if a Netlify invocation ends.

A malicious client may recreate an old room using an old token; this is explicitly tested and is **not** described as token revocation. Such a room is isolated from current listeners. Cleanup, resource monitoring, client lease expiry, signaling-loss handling and provider outage tests remain required. See [GROUP-CALLS.md](GROUP-CALLS.md) for the complete design and operational limitations, including aggregate capacity admission.

Primary references: [LiveKit tokens and refresh](https://docs.livekit.io/home/server/generating-tokens), [participant management](https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/), [RoomServiceClient](https://docs.livekit.io/reference/server-sdk-js/classes/RoomServiceClient.html).

## Required evidence

- Real MySQL/Socket.IO tests for simultaneous acceptances/claims, third participant admission, lease expiry, delayed releases, membership/device denial, durable retirement and recovery.
- Actual SFU tests for microphone/camera media, forbidden screen sources, subscriber-only restrictions, room capacity and reuse of retired tokens. These use synthetic media and are separate from browser/Clerk login verification.
- Real-device staging: two-way P2P, three group participants on different networks, tab audio plus speech, camera-off placeholders, fullscreen/mobile, permission cancellation, microphone replacement and no capture after hangup.
- Forced TURN over each configured UDP/TCP/TLS route, a long call spanning multiple credential refreshes, network handoff and browser suspension.
- Revocation/room migration while sharing or reconnecting; delayed/failed SFU control requests and cleanup retry recovery. Verify no current listener stays in a retired room.
- Existing voice playback, group/direct chat, privacy and watch-party event ordering/reconnect regression.

No test result establishes Hostinger's production capacity or authorizes enabling group flags. Production publication requires the separate explicit approval described in [CALL-INBOX-RELEASE.md](CALL-INBOX-RELEASE.md).
