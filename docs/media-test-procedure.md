# Browser and media test procedure

This is a procedure, not a record of completed browser tests. Record results in [validation.md](validation.md): candidate commit, date, browser/OS, accounts, network, expected/actual behavior and diagnostic reference. An interrupted interaction is **not run**, not a pass. Do not share tokens, SDP, ICE addresses or private messages in test logs.

## Start the isolated app

Use the prerequisites in [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md). From the repository:

```sh
npm run dev:setup
```

Then run these in separate terminals:

```sh
npm run dev
npm run dev:socket
npm run dev:media
```

Open **http://localhost:3000** consistently. Setup preserves local rows, uses `goga_development` on `127.0.0.1:33367`, and leaves the original `.env` and production untouched. Do not substitute a Docker database on this port: the launchers verify this checkout's ownership marker and Unix-socket datadir. Do not launch a duplicate frontend or delete an active development cache.

Use Clerk **development** accounts. Each account must sign in and load the app once; the authenticated local bootstrap creates its profile before socket use. No webhook tunnel or synthetic browser authentication is needed. Production contacts/messages will not appear in this new database. Follow the local guide if startup rejects live keys or a remote `DATABASE_URL`; do not bypass the guard.

For representative local data, run `npm run dev:fixtures` after the first sign-in, then refresh. `npm run dev:status` reports sanitized local counts. Demo profiles are offline synthetic fixtures, not second Clerk sessions. They support feed, profile, saved chat, voice playback and caller-side permission/cancellation checks; they cannot answer a call or establish two-way media. Use the real second account below for those tests.

Check that both `http://localhost:3001/ready` and `http://localhost:3002/ready` return `{"status":"ok"}`. Voice uploads/playback now use the third process with the signed-in Clerk bearer identity; the Next.js filesystem routes are disabled. Open **http://localhost:3000/local-test/watch.mp4**: setup generates this original 15-second test pattern and tone. This is authorized test content. The HTTP exception applies only to isolated development and allowlisted loopback hosts; staging/production sources require approved HTTPS.

## One account: group, text, voice and watch

A group may contain only its creator. No existing contact is required for this smoke test; it does not prove another user's access or invitation consent.

1. Open **http://localhost:3000/chat**. Wait until **New group** becomes available. Select it, enter a unique **Group name**, leave invitations empty, and select **Create group**. Confirm the conversation opens and shows **Connected**. On a narrow viewport, **Back** returns to the list.
2. Enter a harmless **Message** and select **Send message**. Confirm it leaves **Sending…**, reload, and reopen the group: the message must persist. Exercise reply, heart reaction, edit and delete controls. Open the same group in another tab; sends and edits must appear without reloading. Two tabs share one identity and do not prove independent read receipts.
3. Select **Voice message**, allow microphone access, record 3–5 seconds and select **Stop recording**. Preview, pause and seek; then select **Cancel voice message**. Nothing should appear in history. Record again and select **Send voice**. Confirm upload, playback/seek and replay after refresh; check duration and waveform where browser decoding supports it. Capture must stop after recording/cancellation. Repeat once with permission denied, check the error, and restore permission through browser site controls. Limits are two minutes and 4 MiB.
4. Select **Watch together**. Enter `http://localhost:3000/local-test/watch.mp4` in **Authorized video URL**, check the permission declaration and select **Create watch party**. Play/pause/seek; enter **Theater mode**, send a message in **Conversation**, then **Exit theater** or Escape. Theater mode is an in-app full-window layout, not browser fullscreen.
5. Open the same group in the second tab. The party appears and joins automatically; there is no separate Join-party button. Both tabs are the host account, and the count is **one distinct user**, not two tabs. Compare play/pause/seek behavior and reload recovery. If prompted, select **Enable playback on this device**; **Synchronize now** reapplies authoritative state. Finish with **End party**.

Do not use self-DMs or a one-member group for calling. Group media remains gated off. Same-account watch tabs cannot demonstrate member-only controls or host transfer. The 15-second sample cannot establish five-minute drift performance.

## Two accounts: direct chat, calls and screen sharing

Use Alice and Bob in separate browser profiles, not tabs sharing one Clerk session. Use headphones to avoid feedback. Separate physical devices require approved HTTPS staging; do not expose local HTTP/MySQL to a network to work around permissions.

1. Sign in and load the app as both users. Use **Search users...** to find each other's local username and follow each other; accept requests if private. Reload Chat to refresh its contact list, then select the other user. Exchange messages in both directions; check refresh persistence, reply/edit/delete/reactions, typing and read status. With more than 30 messages, test **Load older messages**. Confirm Bob can replay Alice's voice note after refresh.
2. Create a group inviting Bob, or use its settings gear and **Person to invite** / **Invite**. Before acceptance, Bob sees **Invitation** and cannot open history. Select **Join group**; test another invitation with **Decline**. Use disposable groups to exercise **Make admin**, **Remove admin role**, **Remove** and **Leave group** according to role. Removed users lose access. Owner departure transfers ownership only if another active member exists.
3. In the **direct** conversation, select **Voice call** as Alice. Bob should see **Incoming audio call** with **Accept** / **Decline**. Accept, allow permissions and confirm audible speech in both directions. Exercise **Mute** / **Unmute** and **Microphone** selection. Use **Hang up** or **Leave**; both ends must close and release capture. Repeat with Bob initiating, decline, caller cancellation and no answer (approximately 45 seconds). Muting alone need not remove the browser capture indicator.
4. Repeat with **Video call** in both initiation directions. Confirm both cameras and **Camera off** / **Camera on**. Test **Share screen** from both the caller and the answering account; choose the original test-pattern tab or a non-sensitive window. Verify the remote view changes. Test **Stop sharing** and the browser's stop control. The camera resumes only if previously enabled. Direct-call sharing sends screen video with microphone audio; it does **not** capture tab/system audio.
5. Cancel a sharing prompt, deny camera access, unplug a selectable device, and resolve a pending permission prompt after hangup. Errors must be actionable and no new track may remain live after leaving. A second Bob tab must not take over a call accepted in the first tab/device.
6. Create a watch party in the direct conversation. Bob joins automatically by opening it. Only Alice controls playback until **Allow shared playback controls** is enabled. Test simultaneous seeks, Bob's reload, **Transfer host**, and **End party** by the current host. Enabling local autoplay must not grant host powers. Start a direct call before entering theater mode to check its overlay and chat. Screen sharing and synchronized playback are separate features.

## Staging release checks

Local success is not production readiness. Use an approved Netlify staging frontend, isolated HTTPS VPS media API, persistent private voice storage, staging MySQL, FFmpeg and an authorized coturn setup. Follow [VPS-MEDIA-DEPLOYMENT.md](VPS-MEDIA-DEPLOYMENT.md) for exact CORS/Clerk/HTTPS setup; the frontend stays on Netlify. Add Carol as an outsider and complete:

- **Authorization:** copied conversation/media IDs do not grant Carol access or call credentials. Bob cannot read Alice's unsent voice draft. Removal/blocking denies subsequent history, voice byte ranges, signaling and watch controls, including from open tabs. Hangup or account switching during pending requests must not let late replies reopen calls.
- **Separate media API:** confirm the browser sends upload/playback to the configured HTTPS VPS origin with bearer authentication and no cookies/query tokens. Allowed-origin preflight must succeed and an unapproved origin fail. Test GET/HEAD/Range and invalid ranges, expired/tampered tokens, draft deletion by the uploader versus another account, denial of direct deletion once attached, and denied playback after message deletion. Bytes already downloaded into a browser cannot be recalled; verify every new fetch is denied after revocation. Keep bearer values out of evidence captures.
- **Recovery:** interrupt networking for 5 and 25 seconds, restart sockets, background mobile tabs, cross session refresh, and switch Wi-Fi/mobile. Chat retries must not duplicate durable messages; calls must recover or end without indefinite capture. Test interrupted upload/cancel/retry.
- **Device coverage:** test the release's Chrome, Safari/iOS and Android browser/device matrix, bidirectional media, permission failures, autoplay and track cleanup. Record unsupported screen-source choices; browsers do not all expose screen/window/tab selection.
- **TURN:** prove an actual successful `relay` candidate pair, UDP relay and TLS/TCP fallback on restrictive networks. A configured URL or same-computer call is insufficient. Keep credentials/candidate addresses private. Review and remove any temporary staging-only forced-relay override before release.
- **Watch drift:** use an authorized direct file longer than five minutes. Compare timestamps after seeks and after five minutes; target drift below 1.2 seconds, then test reconnect/host changes. Participants fetch the source directly. Subscription players, DRM bypass and unauthorized content are outside this feature.
- **Regression/operations:** complete existing social/private/block/story/poll/share flows and storage quota, disk reserve, database outage, retention, backup restore and load checks in [operations.md](operations.md). Existing Cloudinary, Maps and push need separate validation; do not send unrequested outbound notifications.

Group chat works independently of LiveKit. Group audio/video needs separately approved 2/3/4-user capacity, interoperability and removal/reused-token tests. Short initial token expiry does not resolve self-hosted refresh/revocation semantics. Keep both group-calling flags false until that gate is resolved.

## Evidence and sign-off

After local setup, run the checks listed in [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md), including `npm run test:integration`. That command verifies the owned database, selects disposable `goga_validation` itself, and cleans only its synthetic rows. Actual Clerk SDK signature verification, Socket.IO, HTTP handlers, MySQL and FFmpeg tests do not prove interactive Clerk login, physical capture, browser WebRTC interoperability or TURN.

Record **pass**, **fail** or **not run** per required scenario. Failed or unexecuted release requirements remain blockers. Production deployment requires explicit human review of the exact candidate, migrations, backup/restore evidence, configuration, maintenance window and rollback plan. This procedure performs no production deployment.
