# Local and staging media validation

These steps are a test procedure, not evidence that real device tests have passed. Record the candidate commit, device/OS/browser versions, network, result, and any console error code for each step. Never record tokens, SDP, ICE addresses, or private message contents in shared logs.

## Local automated checks

Use Node 24 LTS, a maintained FFmpeg/ffprobe installation, and a disposable MySQL 8.4 database. Do not reuse a production environment file. One optional local database setup, if Docker is already installed:

```sh
docker run --rm --name goga-validation \
  -p 127.0.0.1:33367:3306 \
  -e MYSQL_ALLOW_EMPTY_PASSWORD=yes \
  -e MYSQL_DATABASE=goga_validation mysql:8.4
```

The empty password applies only to this disposable loopback test instance. Wait for MySQL readiness. In a second terminal:

```sh
npm ci
DATABASE_URL='mysql://root@127.0.0.1:33367/goga_validation' npm run db:deploy
npm run typecheck
npm run lint
npm test
GOGA_TEST_DATABASE_URL='mysql://root@127.0.0.1:33367/goga_validation' npm run test:integration
```

On macOS set FFMPEG_PATH and FFPROBE_PATH if binaries differ from `/opt/homebrew/bin`; Linux tests default to `/usr/bin`. The integration script refuses every database address other than `127.0.0.1:33367/goga_validation`. It creates synthetic users and removes its own rows. Stop only the disposable database when finished. Never run these fixtures against production.

For interactive localhost development, configure a Clerk **development** instance, its signed webhook into this local/staging database, and three test accounts. Use a private real directory outside the repository for VOICE_STORAGE_DIR. Run Next on port 3000 and Socket.IO on 3001 with exact `http://localhost:3000` allowed origin. Load the socket environment explicitly in your process manager/terminal; `node socket-server.js` does not load `.env`. Use separate app/socket environments so PORT=3001 does not change the Next listener.

Two browser profiles on the same computer can use localhost. Separate physical devices require a trusted HTTPS staging origin and secure Socket.IO endpoint. Plain HTTP on a LAN address generally cannot use microphone/camera APIs. Do not disable browser security or publish a development server to the internet to work around this.

## Prepare an isolated HTTPS staging site

An administrator must approve provisioning first. Use isolated application secrets, a staging MySQL database, a Clerk development instance, persistent private voice storage, FFmpeg, and an authorized coturn configuration. Keep both group-calling flags false. Set the exact APP_ORIGIN, SOCKET_ALLOWED_ORIGINS and NEXT_PUBLIC_SOCKET_URL. Allowlist a small direct media test file that you own in WATCH_ALLOWED_HOSTS. Check app `/api/health`, socket `/health` and `/ready` before signing in.

Use Alice on device A, Bob on device B, and Carol in a separate profile as an outsider. Ensure the local User records exist through the signed Clerk webhook. Start on different networks where possible, such as home Wi-Fi and mobile data. Use headphones to avoid acoustic feedback.

## Required acceptance sequence

1. **Existing social behavior:** sign in/out; edit a profile; create/read/delete a post; add likes/comments/replies; follow/unfollow a public and private account; accept/reject requests; create/view/archive/repost a story and highlight; vote in a poll; share a post. Verify private/blocked content and hidden activity/likes/viewers remain hidden after refresh and account switching. Test existing media, Google Maps and push subscription flows separately; no outbound test notifications are sent by the automated suite.
2. **Messaging and groups:** exchange direct messages, replies, edits, deletions and reactions. Open a second Alice tab. Retry a send after a connection drop and confirm one durable message. Load older history, verify read cursors and typing clear. Create a group, invite Bob, accept as Bob, and decline another invite. Verify only owners/admins perform their allowed role/removal operations, owner departure transfers responsibility, and removal immediately denies history and further events. Carol must fail joins, reads and controls even with copied IDs.
3. **Voice notes:** deny microphone access once, then allow and record on each device. Preview, cancel, record again, upload and send. Verify waveform, actual duration, play/pause/seek, and replay after refresh. Upload during a network interruption and retry without duplicating the send. Test the two-minute limit and wrong-content rejection. Bob cannot read Alice's unsent draft, Carol cannot read either sent asset, and removed/blocked Bob cannot fetch a new byte range. Confirm no static web path serves private files.
4. **One-to-one audio:** Alice calls Bob; confirm ringing, accept and two-way audible speech. Repeat with Bob initiating. Test decline, caller cancellation, no answer, mute/unmute and microphone selection. Hang up from each end and confirm microphone capture stops. A second Bob tab must not take over an accepted call. A third user must not obtain ICE credentials or relay signaling for this call.
5. **Video and screen sharing:** repeat with video enabled in both initiation directions. Confirm both live cameras are visible; camera off/on works from either end. Share a window, tab and screen where supported, including from the answering device. Stop via browser UI and in-app control; the camera should resume. Cancel a permission prompt, unplug a device, and resolve a permission prompt after hangup. No microphone, camera or screen track should remain live after leaving.
6. **Reconnection:** disconnect networking for 5 seconds and then 25 seconds; switch Wi-Fi/mobile; background a mobile tab; leave a tab long enough to need a refreshed Clerk token. Restore connectivity and verify chat recovers with current authorization. Calls must reconnect or end with an actionable message, never silently capture media forever. Hang up while a state request or acceptance is pending and confirm a late response cannot reopen the call. Repeat after sign-out/account switching.
7. **TURN:** verify a successful ICE candidate pair uses `relay` in browser WebRTC diagnostics, not merely that a TURN URL exists. Test UDP relay and TLS/TCP fallback on restrictive networks; record aggregate bytes and CPU/RSS without logging credentials/IP candidates. If necessary use a temporary staging-only `iceTransportPolicy: 'relay'` test build, then remove that override and rebuild before release. Expired credentials and anonymous allocation must fail. Do not claim fallback works from a same-LAN test.
8. **Watch party:** use your authorized direct file. Alice starts, Bob joins, then play/pause/seek from the host. Bob controls only when collaborative mode is enabled. Issue simultaneous controls and verify the server version wins. Refresh/reconnect Bob, transfer host, remove a member, and test mobile autoplay denial. Compare playback timestamps after seeking and after five minutes (target drift under 1.2 seconds). Enter/exit theater mode, exchange chat, and maintain a call overlay. This tests synchronized direct playback; screen sharing is a separate call control.
9. **Operational failures:** stage encoder busy, disk quota/reserve exhaustion, database outage, socket restart and backup restore. Errors must be actionable, files private, and retries safe. Review load targets and resource budgets in operations.md. Do not run load tests against production.

## Group media gate

Group chat does not require LiveKit and is included above. Group audio/video remains disabled. A separately approved self-hosted LiveKit staging server must pass 2/3/4-user media, screen sharing, device cleanup, outsider denial, removal/reused-token tests, and CPU/memory/bandwidth measurement. Self-hosted token refresh/revocation semantics are an unresolved security gate; setting flags is not evidence of validation. Keep both flags false in production until that gate is resolved.

## Sign-off record

For every required row record: commit; environment; actors/devices; expected/actual behavior; pass/fail; issue reference; test date; reviewer. Failed or unexecuted rows remain release blockers. After staging passes, prepare one production approval request naming the exact commit, migration, backup/restore evidence, configuration changes, maintenance window, operator and rollback plan.
