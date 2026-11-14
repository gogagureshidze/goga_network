# Validation record — 14 November 2026

Branch: `codex/communications-hardening`. Local application candidate only; no production deployment or infrastructure mutation. The original user change in `src/components/Post.tsx` is preserved separately. No exposed passwords were used.

## Netlify / VPS voice architecture update — 14 November

Next.js remains on Netlify. The prepared `media-server.js` process serves private voice HTTP requests on VPS loopback port 3002 behind the dedicated HTTPS CloudPanel proxy; deployment targets `/srv/goga/private-voice`. It reuses the existing Prisma/MySQL, conversation authorization, media policy and FFmpeg storage modules. No schema, migration or dependency-version change was needed. Nothing was deployed, and no production database or infrastructure was contacted or changed.

The browser uses `NEXT_PUBLIC_MEDIA_API_URL` with a current Clerk bearer token, omits cookies and refuses redirects. Existing stored relative media references remain valid. The API verifies signatures, expiry, session ID and exact authorized party/origin, then current account, membership and block rules. It supports authenticated GET/HEAD/Range, owner-only unattached DELETE, bounded multipart uploads, account/concurrency limits, timeouts, disk quotas, sanitized diagnostics and readiness. Next voice routes return an actionable service-required error without importing filesystem processing. The Netlify trace check also excludes VPS-only runtime code.

Final verification for this update:

- **187 unit tests passed**, including cross-origin frontend uploads/playback, blob cleanup, Clerk signatures, CORS, HTTPS/Host enforcement, size/rate limits, early/partial upload aborts and failed readiness.
- **19 MySQL integration tests passed**: original 1, Socket.IO/runtime 8, fixtures 1, dedicated media API 9. Actual HTTP, signed synthetic sessions through the Clerk SDK, FFmpeg and isolated MySQL exercise file permissions, upload/send, full/range/suffix/HEAD playback, group invite/removal/block denial, deletion, concurrent send/delete, post-encoding revocation and repeated playback aborts. No tests skipped.
- Typecheck, lint (zero errors/six existing warnings), production build under Node 24.7 and all 28 artifact traces passed. Existing Next middleware/Prisma tracing warnings remain. Production build used an explicit guarded local database override and a placeholder HTTPS media origin; it is not a deployed Netlify build.
- Dedicated local service readiness, CORS preflight and anonymous denial passed on port 3002. The signed-in in-app browser played the existing generated three-second private note across origins (frontend 3000 → API 3002), showed Pause/seek controls and reached its duration; service metrics confirmed a successful read with no failures. The existing relative reference required no rewrite. A new browser recording attempt remained at microphone permission and was cancelled; new browser upload and real HTTPS Netlify-to-VPS playback remain staging checks. Automated actual HTTP uploads passed.
- Local nginx snippet validation and 16 documented shell-block syntax checks passed. Linux systemd hardening, real CloudPanel/TLS and resource ceilings were not exercised.

Tests uncovered and fixed a FileHandle ownership race after HEAD/aborted playback, and a 20-second capacity leak when a client disconnected during asynchronous authentication. The browser initially exposed a stale public media environment value in the long-running Next process; a controlled development-only restart loaded it. Local startup now requires `npm run dev`, `npm run dev:socket` and `npm run dev:media` in separate terminals. No automatic migrations occur on startup.

Use [VPS-MEDIA-DEPLOYMENT.md](VPS-MEDIA-DEPLOYMENT.md) for exact conditional commands, service/environment/proxy templates, preservation of existing recordings, staging gates, backups and rollback. Production physical-file retention still requires a separately reviewed job; the existing CLI deliberately refuses production. Group LiveKit remains disabled. The earlier browser and migration evidence below records the preceding local implementation and is not additional proof of this new production topology.

## Implemented scope

- Existing Clerk identities, Prisma/MySQL models and Socket.IO transport retained. Authenticated socket handshakes and refresh; current membership/block checks on events, room joins, media and credentials; bounded rate/in-flight limits, multi-tab presence and reconnect recovery.
- Direct and group messaging, invitation consent, owner/admin/member roles, removal and succession; idempotent optimistic sends/retries, history pagination, replies, reactions, editing/deletion, read cursors and typing. Shared posts use one durable send and revalidate source visibility.
- Voice recording, preview/cancel, waveform and playback/seek; private self-hosted bounded FFmpeg normalization, authorized byte ranges, draft ownership, quotas and retention rehearsal. No new paid media API.
- Native one-to-one audio/video with ringing/accept/decline/missed/hangup, accepted-device signaling, microphone/camera controls, input selection, screen sharing, TURN credential renewal and cleanup. Late permission prompts and acknowledgements cannot revive released sessions; answering peers use the negotiated video transceiver.
- Conversation watch parties using authorized allowlisted direct media, durable ordered playback state, host/collaborative controls, reconnection/drift correction, host transfer, theater mode, chat and call overlay.
- Self-hosted LiveKit integration exists but both group-calling flags remain false pending capacity and media-token revocation validation. Group chat works independently of those flags.
- Social access fixes for polls, stories/highlights, comments/replies, shared posts, profiles, blocks/follows, webhooks and push subscription ownership. Bounded user search, safer caption media fetching, loading/error boundaries, security headers, process health and privacy-safe operational diagnostics.

## Results

| Check | Result and boundaries |
|---|---|
| `npm run typecheck` | Passed with the final source and generated Prisma client |
| `npm run lint` | Passed: zero errors, six existing warnings in highlights, Greet, Navbar, Observer and PostInteractions |
| `npm test` | 165 passed, zero failed/skipped; includes actual loopback Socket.IO/FFmpeg, recorder deadline and decoded-duration boundaries, theater edits/retries/reconnect races, and fixture CLI rejection of remote database targets |
| `npm run test:integration` | Original MySQL suite 1/1, runtime suite 8/8 and local-fixture suite 1/1 passed against owned disposable MySQL 8.4.9 on `127.0.0.1:33367/goga_validation`. Runtime suite uses actual Socket.IO, Prisma, Clerk SDK signature verification with ephemeral synthetic JWTs, HTTP voice/media/ICE handlers and FFmpeg. Covers list/history, duplicate sends/tabs, group roles, upload/range ownership, calls, watch ordering/reconnect and revocation. Fixture suite checks populated data, pagination, outsider/invite denial and repeat-run preservation of edited posts/renamed groups. |
| Migration deploy | Both migrations applied successfully to empty disposable MySQL |
| Historical-data rehearsal | Applied baseline, inserted synthetic existing users/post/direct conversation/message/media fields, applied expansion; original values and all three RESTRICT foreign keys preserved |
| Schema comparison | Migrated local database matches the Prisma schema: no difference detected. Schema-file diff differs only by explicit drop/recreation of the three preserved RESTRICT constraints; no production introspection used |
| `npm run build` | Passed under Node 24.7 with the isolated local database override and existing development Clerk configuration; existing and new routes compiled. Frontend HTTP still returned 200 after the build while dev remained running. |
| `node scripts/check-build-artifacts.js` | Passed: 28 deployment traces exclude root environment files, private keys, Git metadata, `.local` databases/credentials and generated local test media |
| Live local startup | `dev:setup` applied both reviewed migrations to fresh owned development/test databases, then repeated with no pending migrations. Next and Socket.IO start through guarded commands; schema preflight checks 12 tables/87 columns. Socket sweeps ran for over nine minutes without errors. Duplicate frontend startup and active-cache deletion were safely refused. |
| Browser/HTTP | Signed-in Chrome loaded populated feed, stories, profiles, direct/group chat and actual private voice playback. Browser-originated actions persisted in `goga_development`; detailed results below. Second-account/two-way media is still unverified. |
| Lockfile check | `npm ci --dry-run --ignore-scripts --offline` passed; full clean Linux install is delegated to CI/staging, not claimed executed locally |
| Dependency audit | Zero high/critical; eight moderate advisories remain in minimatch/nodemon/TypeScript ESLint dependency chains. No forced incompatible upgrades applied |
| Shell/config checks | SSH/audit scripts pass `bash -n`; `git diff --check` passed. coturn options reviewed against upstream example, not run on a TURN server |

The complete suite, lint, typecheck and build passed after the local runtime, populated-data and communications fixes. Local socket/MySQL tests require execution permission for loopback networking; no tests were silently skipped. Historical-data migration rehearsal, dependency and lockfile checks above were performed on 13 November; no migration file or dependency version changed during the 14 November repair.

## Populated local database and interactive Chrome verification

The empty-app report was reproduced: the guarded app database contained one verified Clerk development profile and zero posts, follows, stories, conversations or messages. The original production `.env` was overridden intentionally; content was not lost or hidden by a mismatched local account. Socket.IO's running environment selected `127.0.0.1:33367/goga_development`. Prisma's `SELECT DATABASE(), @@port` confirmed that identity. Next's real voice-upload handler and Socket.IO browser sends subsequently wrote into that same database; own-profile content, ownership controls and saved messages confirmed the account mapping. No production connection was made.

`dev:fixtures` added three offline synthetic profiles and linked content to the existing verified development identity. After browser checks the local database had 4 users, 15 posts, 6 follows, 2 stories, 5 comments, 6 conversations, 56 messages, 2 voice assets and 1 ended watch party. Rerunning the fixture command preserved the existing counts, browser messages and group. See `dev:status` for current counts; further local use changes them.

The final read-only check confirmed zero ringing/active calls, zero open watch parties and a successful Socket.IO readiness response.

Personally exercised through native Chrome controls at localhost:

- Populated homepage, corrected photo discriminator (`photo`, matching the existing upload contract), story viewer, synthetic profile and the signed-in user's profile/follower counts. Like changed to Unlike with count increment; poll displayed its persisted vote; a browser comment appeared with the correct author.
- Direct history, browser message acknowledgement as Sent, new group creation, subsequent-tab history restoration and live message delivery into the first tab's theater. The real browser checks used one Clerk account across two tabs; independent-user authorization remains covered by the integration suite, not inferred from those tabs.
- Real microphone capture, preview playback, cancellation, a second approximately 20-second recording, HTTP upload/FFmpeg storage, durable voice send, authorized playback, pause/seek and history restoration in another tab. Chrome's microphone recording indicator disappeared on stop. Audible quality and Safari/mobile capture were not evaluated.
- Authorized generated watch clip: creation, play/pause/seek, persisted playback version/position, theater mode/message send, an edit reflected in theater, same-account second-tab room restoration at the saved position, and ending the room. This is not a long-running, distinct-user drift test.
- Outgoing audio capture to an explicitly offline demo contact, mute state, screen-source chooser, cancellation error handling, hangup and disappearance of Chrome's microphone indicator. A video attempt showed the expected actionable camera-permission-denied error and was ended. No demo contact was made to impersonate an authenticated answering user; no two-way media or actual screen transmission is claimed.

Fixed during this pass: theater chat ignored edits/deletes and could duplicate timed-out sends or overwrite newer drafts; it now reconciles updates, retries stable IDs and refetches authoritative history on reconnect with visible errors. Voice recording stopped too close to the server's hard 120-second maximum; a dedicated 119-second deadline, immediate track release and decoded-duration check provide headroom without relaxing server limits. An actual FFmpeg regression reproduces rejection of a 120.25-second streaming WebM and acceptance at 119.25 seconds. Next's default Server Action argument logging was disabled to avoid message/push-key exposure.

Chrome extensions injected `data-writer-injected`/`speechify-screenshot-mode` into server-rendered markup and caused hydration diagnostics. They were not hidden with suppression or changes to the user's extensions. A clean browser profile is still required for the release matrix. The one demo-media load error was traced to the initial fixture discriminator and corrected; the photo rendered correctly afterward.

The original `.env` selected the supplied production VPS and lacked a local override. Existing development logs identified missing `Conversation.kind`; a separate local baseline reproduced the failed conversation query and `CallSession` sweep (`P2021`). The original `.env` was left untouched; `.env.local` now selects an isolated database. No new production connection, migration, seed or infrastructure change was made. The actual production schema beyond the existing log was not introspected. See [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md) for exact startup, account setup and cache recovery commands.

Build warnings remain for the existing middleware naming convention and Prisma 5 dynamic filesystem tracing. The trace exclusion/check addresses private-file packaging; warning-free migration to a new Prisma generation strategy is outside this compatibility slice. The newly added GitHub workflow runs checks only and has not been executed on GitHub yet.

## Migrations and changed areas

- `prisma/migrations/00000000000000_baseline/migration.sql`: repository's original schema; must be reconciled with actual deployed schema before baseline resolution.
- `prisma/migrations/20261113000000_communications/migration.sql`: nullable direct endpoints with preserved RESTRICT rules, larger message text, lifecycle/idempotency/media columns and indexes; new ConversationMember, MessageReaction, MediaAsset, CallSession, CallParticipant and WatchParty tables. No data-deleting statement.
- `server/`, `socket-server.js`: socket/event policy, durable chat/call/watch services, media encoding and limits.
- `src/components/MainChat.tsx`, `src/components/chat/`, `src/components/communications/`, `src/hooks/useRealtimeSocket.ts`: integrated UI and media lifecycle.
- `src/app/api/chat/`, `src/app/api/calls/`, `src/actions/`, `src/lib/`: authorized HTTP/actions, social fixes and shared policies.
- `tests/`, `.github/workflows/ci.yml`, `scripts/`, `ops/`, `docs/`: verification, review-only infrastructure templates and operations.

## Unverified and release-blocking

1. Actual VPS capacity, CloudPanel site/process topology, firewall, DNS/TLS and reverse proxy. Previous key-only SSH authentication was rejected; no subsequent production connection was attempted.
2. Real authenticated Clerk/browser interactions across two physical devices, two-way audio/video and screen transmission, Safari/mobile playback, network handoffs and forced TURN relay. One account's local browser flows passed as listed above; a second interactive account was unavailable, camera access was denied and TURN is unconfigured locally. The integration suite and caller-side controls do not prove audiovisual interoperability. No credentials were requested in chat.
3. Representative restored production schema/data, migration lock duration, backup restoration, real Linux FFmpeg performance, load/soak budgets and rollback rehearsal.
4. Group LiveKit capacity and removal/reused-token revocation. Both flags must stay false; initial JWT TTL is not a complete revocation control.
5. Existing social Cloudinary public delivery/unsigned upload policy remains a known privacy boundary outside the new private voice path. An operator must review provider configuration and existing assets before making privacy promises. Existing account deletion/retention policy and legacy social scalability risks are documented in `audit-social.md`.
6. Approved production retention/maintenance scheduling and alerting. The supplied voice retention CLI is a staging rehearsal and cannot silently run against production. No remote jobs, keys, packages or services were installed.

Use `media-test-procedure.md` for the device matrix, `operations.md` for resources/migrations/backups/rollback, and `deployment-access.md` for the minimal secure access setup. Production approval should be requested only after the exact candidate passes staging and the operator has reviewed the release changes.
