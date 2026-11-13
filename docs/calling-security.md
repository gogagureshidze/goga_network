# Call credentials and staging checks

Direct calls use native WebRTC. Socket.IO carries authenticated invitations and
SDP/ICE signaling; it never relays media bytes. Calls bind each accepted participant
to a device identifier. Credential requests check current conversation membership,
both-direction blocks, JOINED state, active call expiry and the accepted device.

`GET /api/calls/:id/ice?deviceId=...` returns configured `RTC_STUN_URLS` and
`TURN_URLS`. TURN credentials use coturn's shared-secret HMAC-SHA1 convention with
an expiry, opaque user digest and random nonce. `TURN_SHARED_SECRET` stays on the
server. Credentials last five minutes; active clients must refresh ICE configuration
before expiry, and test long calls through forced relay. Without configured TURN,
some NAT/firewall combinations cannot connect. `relayAvailable:false` makes that
limitation explicit. No public STUN/TURN service is silently selected.

`POST /api/calls/:id/token` accepts same-origin JSON `{deviceId}` of at most 1 KB.
It emits a 30-second initial LiveKit join token for the server-created room name and
authenticated account. Grants permit subscribing plus microphone, camera and screen
tracks. Data publishing, room creation/listing/admin/recording and ingress control
are denied. `LIVEKIT_URL` must use `wss:` in production; local development can use
`ws://localhost`. Secrets and signing SDK are server-only. Both routes share a bounded
per-account 30 requests/minute process-local budget.

Group calls remain disabled unless **both** `ENABLE_GROUP_CALLS=true` and
`GROUP_CALL_SECURITY_REVIEWED=true` are set, with a configured LiveKit control client.
The second flag records a human security review; it does not itself fix revocation.
The small-server participant limit is at most four. Do not enable these flags merely
to make a staging test pass.

## Self-hosted LiveKit revocation blocker

LiveKit can refresh tokens for connected clients. Initial JWT expiration does not
bound reconnect authorization, and self-hosted participant removal does not revoke
all previously issued/refreshed credentials. Consequently this application's short
initial TTL and `removeParticipant` call **do not prove** that a removed member can
never rejoin media. App API and socket authorization deny further app operations,
but the SFU boundary needs its own tested revocation policy. Review an enforceable
media-server authorization/room-rotation policy before enabling production group
calls. Do not describe the 30-second TTL as a complete revocation window.

Sources checked against installed SDK 2.19.3:
[AccessToken API](https://docs.livekit.io/reference/server-sdk-js/classes/AccessToken.html),
[token lifecycle and refresh](https://docs.livekit.io/frontends/reference/tokens-grants/),
[RoomServiceClient API](https://docs.livekit.io/reference/server-sdk-js/classes/RoomServiceClient.html).

## Required staging evidence

- Two real separate identities: accepted member gets credentials; outsider,
  invited-but-unaccepted member, blocked member, removed member, expired call and
  wrong device get none. Capture status codes without logging credentials.
- Multiple tabs: only the accepted device opens tracks or signals. Reconnect inside
  the 20-second grace period restores state; an abandoned device leaves after grace.
- Direct offer/answer, camera toggle, mic mute, device changes and screen-share stop
  terminate old tracks and do not leak capture after hangup or route changes.
- Forced TURN on mobile and restrictive networks; a call longer than ten minutes;
  network handoff; denied browser permissions; unplugged microphone/camera.
- Group revocation with a deliberately retained and refreshed media token, attempted
  rejoin after removal, browser reconnect and media-room recreation. This is blocked
  without a real configured media server and an accepted mitigation.
- Watch host-only/collaborative controls, stale versions, clock drift, host removal
  and reconnect using separate browsers/devices. Content must be authorized direct
  video from exact `WATCH_ALLOWED_HOSTS`; no DRM or provider restrictions are bypassed.

Automated tests sign and verify real JWTs but mock application persistence. They
cannot establish browser connectivity, TURN allocation or actual SFU revocation.
