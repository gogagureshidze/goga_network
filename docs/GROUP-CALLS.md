# Three-person calls and exclusive screen sharing

This branch adds group calling using the existing LiveKit SDKs. Both `ENABLE_GROUP_CALLS` and `GROUP_CALL_SECURITY_REVIEWED` remain **false by default**. No media provider, production server, account or paid service has been provisioned. Self-hosted open-source LiveKit is supported; an already authorized LiveKit Cloud project can use the same API. Never enable production merely because the unit tests pass.

## Media and authorization

- The authenticated conversation, accepted account/device and unexpired call are checked before every credential, acceptance and sharing operation. At most three accounts can accept; larger groups may receive invitations, but only the first two acceptances join the initiator. The third invitation remains visible after the second participant answers.
- The main room permits microphone and camera sources only. Each screen share receives a fresh private room and a 20-second database lease. Only its holder may publish screen video/audio; everyone else receives subscribe-only credentials. Microphone conversation continues in the main room. The client renews its lease every seven seconds and stops sharing when signaling or authorization is lost.
- Claims, releases, acceptance and departures serialize on durable rows with READ COMMITTED isolation. A delayed release names its old lease and cannot stop a new holder. Capture cancellation releases tracks; authorization failures never publish captured content.
- A new lease always has a new room name. When a joined member leaves or loses membership, remaining members move to a fresh main-room epoch and any screen room is retired. Camera/microphone preferences are retained during that reconnection. Leaving does not end the call for remaining participants.
- Verified Clerk account deletion locks the user and retires/rotates calls in the same transaction before cascading participant deletion. Concurrent call creation cannot insert a participant between revocation and deletion. Existing restrictive foreign keys still block deletion safely and return a retryable webhook failure; they are not bypassed.
- Tokens are signed server-side, scoped to the selected room and account, initially valid for 30 seconds, with no room administration, recording, data publishing or own-metadata privileges. Room creation verifies a three-participant SFU capacity limit before tokens are issued. Provider API failure fails closed.
- Retired rooms are recorded durably and deletion is retried. The default tombstone lifetime is 24 hours (`LIVEKIT_RETIRED_ROOM_TTL_MS`), with a 15-minute minimum. It must exceed the selected server's refreshed-token lifetime plus clock/network margin. Never reuse retired names.

Self-hosted LiveKit **does not revoke cached/refreshed tokens** when permissions change or a participant is removed. The protection here is room isolation: an old token can recreate an old room but cannot enter the current room. Retired-room deletion limits orphan resource use; it is not a permanent token denylist. The client closes expired/retired sessions, and failed provider cleanup emits `rooms.retired_media_cleanup_failed`. Alert on these failures and test control-plane outages before enabling groups. A malicious client can mislabel arbitrary media as camera input; source permissions govern protocol track sources, not the semantic contents of captured pixels.

Sources: [LiveKit token lifecycle](https://docs.livekit.io/home/server/generating-tokens), [room service API](https://docs.livekit.io/reference/other/roomservice-api/). The installed server SDK is 2.19.3 and browser SDK is 2.24.0; no application dependency was added.

## Required environment

Set matching **server-only** values on Netlify and the existing Socket.IO process:

```dotenv
ENABLE_GROUP_CALLS=false
GROUP_CALL_SECURITY_REVIEWED=false
GROUP_CALL_MAX_PARTICIPANTS=3
LIVEKIT_URL=wss://YOUR_REVIEWED_MEDIA_HOST
LIVEKIT_API_KEY=SET_SECURELY
LIVEKIT_API_SECRET=SET_SECURELY
# Optional; default 24 hours. Must exceed refreshed-token lifetime plus margin.
LIVEKIT_RETIRED_ROOM_TTL_MS=86400000
```

The URL uses `wss:` in production. HTTP/WebSocket loopback is accepted only outside production. Secrets never use `NEXT_PUBLIC_`. P2P TURN values are separate; see [TURN-VALIDATION.md](TURN-VALIDATION.md). Do not route LiveKit media bytes through Socket.IO or Netlify.

The additive migration `20261115000000_group_media_leases` adds seven CallSession columns, two unique indexes and RetiredMediaRoom. It deletes/backfills no application rows. It is needed by the updated Prisma client even with groups disabled. Apply on isolated staging first, measure ALTER lock duration, then follow the approved migration/release procedure. Existing MySQL, messages and users remain in place.

## Reproducible local SFU test

The regular MySQL suite tests transactional races and real Socket.IO/HTTP authorization with synthetic sessions. The optional SFU test additionally uses three real native WebRTC clients with generated audio/video and the application's token signer. Its persistence adapter is synthetic: it complements, rather than replaces, MySQL tests. It does not use a microphone, camera or logged-in Clerk session.

The Mac host cannot reliably route WebRTC to Docker's advertised private candidate addresses. Run the test clients in the test server's network namespace. These commands create **only disposable local containers**, publish ports on loopback and mount the checkout read-only in the client container. They do not change application dependencies or access a database. Node SDK 1.2.2 is installed only in a temporary test directory.

```sh
set -eu
GOGA_REPO="$(pwd)"
test -f "$GOGA_REPO/ops/livekit.local-test.yaml"
GOGA_SFU_TOOLS="$(mktemp -d "${TMPDIR:-/tmp}/goga-sfu-tools.XXXXXX")"
docker pull livekit/livekit-server:v1.13.11
docker pull node:24-bookworm-slim
# Refuse a name collision; never stop an unrelated existing container.
test -z "$(docker ps -aq --filter name='^goga-livekit-validation$')"
docker run --rm -d --name goga-livekit-validation --cpus=1 --memory=512m \
  -p 127.0.0.1:17880:17880 -p 127.0.0.1:17881:17881 \
  -p 127.0.0.1:17882:17882/udp \
  --mount "type=bind,source=$GOGA_REPO/ops/livekit.local-test.yaml,target=/etc/livekit-test.yaml,readonly" \
  livekit/livekit-server:v1.13.11 --config /etc/livekit-test.yaml
trap 'docker stop goga-livekit-validation >/dev/null' EXIT
curl --fail --silent --show-error http://127.0.0.1:17880/
docker run --rm --name goga-livekit-client-validation \
  --network container:goga-livekit-validation --cpus=2 --memory=1g \
  --mount "type=bind,source=$GOGA_REPO,target=/workspace,readonly" \
  --mount "type=bind,source=$GOGA_SFU_TOOLS,target=/tools" \
  -e GOGA_LOCAL_SFU_TEST=true \
  -e GOGA_RTC_NODE_TEST_MODULE=/tools/node_modules/@livekit/rtc-node \
  -w /workspace node:24-bookworm-slim sh -c \
  'npm install --prefix /tools --no-audit --no-fund @livekit/rtc-node@1.2.2 && node --test tests/livekit-sfu.integration.cjs'
```

Record the resolved image digests with results; production images must be pinned and reviewed independently. The test configuration has public test-only keys, no TLS and no TURN. **Never deploy `ops/livekit.local-test.yaml`.**

## Real-device staging gate

Use three real development accounts on three devices/networks with HTTPS staging, an isolated database, reviewed LiveKit configuration and production-like TURN connectivity. Enable group flags only in that staging environment.

1. Alice starts a group video call. Bob answers, then Carol answers while ACTIVE. Check independent speech/video, names, active speakers, camera-off placeholders and microphone selection. A fourth acceptance and a different unaccepted device must fail. Test anonymous/outsider/blocked/removed credential requests.
2. Race Alice and Bob's Share buttons. Exactly one claim wins. Capture prompts may appear before the claim; the losing browser must release all captured tracks. Denied/cancelled prompts must not hold the lease. Attempt screen and screen-audio publication using a modified subscriber and main-room token; confirm the SFU never publishes those sources.
3. Share a different authorized browser tab, explicitly check **Share tab audio**, and use headphones. Each remote hears tab audio and microphone once. Mic mute leaves content audio playing. Whole-desktop/system audio is excluded to avoid feeding the call's audio back. Unsupported browsers show video-only guidance. Test browser Stop sharing and switching cameras/microphones while sharing.
4. Race stop/restart, disconnect the sharer, delay an old release and reconnect after lease expiry. Remaining clients must not resubscribe to the retired room. Retain a refreshed old token, recreate the old room and verify it cannot reach current listeners or the current sharing room. Test provider API failures and tombstone cleanup recovery.
5. Carol leaves: Alice/Bob remain in the app call and briefly reconnect their main media epoch. Remove/block Carol, reuse her old token and request fresh credentials. Verify current-room isolation and denial. Repeat during a share and a camera permission prompt.
6. Fullscreen, expanded/compact and mobile orientation: content fits without cropping, cameras remain compact and all controls stay accessible. Test autoplay rejection, permissions, devices unplugged, network changes, 30-minute calls and hangup during pending capture. No capture indicator may remain after leaving.

## Initial resource budget, not a capacity claim

Browser camera publishing is capped at approximately 350 kbit/s per participant; screen video at 1 Mbit/s, with limited resolution/frame rate and no simulcast. At three cameras plus one screen, allow approximately **2.4 Mbit/s ingress and 4.8 Mbit/s egress** including an assumed 64 kbit/s per microphone and 128 kbit/s screen audio, before protocol overhead. That is roughly **3.2 GB/hour total traffic**, or about **3.8 GB/hour with 20% headroom**. TURN topology and retransmissions can increase this. Confirm the VPS provider's bandwidth accounting.

The extra screen room doubles concurrent SFU participant sessions from three to six while sharing. Cloud connections/traffic may incur charges; no purchase is authorized. Self-hosting avoids a paid media API but consumes VPS CPU, RAM and bandwidth. A successful local container test is not proof that the 1 vCPU VPS can host groups alongside MySQL, Socket.IO, media FFmpeg and the independent blog API.

Before enabling production, measure representative peak app traffic plus concurrent calls/uploads for at least 30 minutes. Require agreed CPU/RAM/latency budgets, no swap growth, sufficient disk reserve and MySQL latency within the baseline budget. Start with one group call in the capacity test, then increase until a measured admission budget is established. This branch caps participants per call, not the total number of concurrent group calls. Production rollout remains gated until aggregate capacity/admission policy and alerts are approved. Do not solve this by moving Next.js off Netlify or restarting unrelated services.
