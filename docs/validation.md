# Validation record — 14 November 2026

Branch: `codex/communications-hardening`. Local application candidate only; no production deployment or infrastructure mutation. The original user change in `src/components/Post.tsx` is preserved separately. No exposed passwords were used.

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
| `npm test` | 149 passed, zero failed/skipped; actual loopback Socket.IO and FFmpeg tests plus isolated service/client/bootstrap/redirect/diagnostic tests |
| `npm run test:integration` | Original MySQL suite 1/1 and runtime suite 8/8 passed against owned disposable MySQL 8.4.9 on `127.0.0.1:33367/goga_validation`. Runtime suite uses actual Socket.IO, Prisma, Clerk SDK signature verification with ephemeral synthetic JWTs, HTTP voice/media/ICE handlers and FFmpeg. Covers list/history, duplicate sends/tabs, group roles, upload/range ownership, calls, watch ordering/reconnect and revocation. No interactive Clerk session is implied. |
| Migration deploy | Both migrations applied successfully to empty disposable MySQL |
| Historical-data rehearsal | Applied baseline, inserted synthetic existing users/post/direct conversation/message/media fields, applied expansion; original values and all three RESTRICT foreign keys preserved |
| Schema comparison | Migrated local database matches the Prisma schema: no difference detected. Schema-file diff differs only by explicit drop/recreation of the three preserved RESTRICT constraints; no production introspection used |
| `npm run build` | Passed under Node 24.7 with the isolated local database override and existing development Clerk configuration; existing and new routes compiled. Frontend HTTP still returned 200 after the build while dev remained running. |
| `node scripts/check-build-artifacts.js` | Passed: 28 deployment traces exclude root environment files, private keys, Git metadata, `.local` databases/credentials and generated local test media |
| Live local startup | `dev:setup` applied both reviewed migrations to fresh owned development/test databases, then repeated with no pending migrations. Next and Socket.IO start through guarded commands; schema preflight checks 12 tables/87 columns. Socket sweeps ran for over nine minutes without errors. Duplicate frontend startup and active-cache deletion were safely refused. |
| Browser/HTTP | Home, sign-in, generated MP4 fixture and socket readiness returned 200. The actual Clerk development sign-in form remained on `/sign-in` after the redirect fix. An existing authenticated Chrome session loaded Chat, bootstrapped one local profile, connected its socket and displayed the empty conversation list/new-group controls without request errors. Two-account interactive sending/media remains unverified; the group dialog opened but its interrupted submission did not persist a group. |
| Lockfile check | `npm ci --dry-run --ignore-scripts --offline` passed; full clean Linux install is delegated to CI/staging, not claimed executed locally |
| Dependency audit | Zero high/critical; eight moderate advisories remain in minimatch/nodemon/TypeScript ESLint dependency chains. No forced incompatible upgrades applied |
| Shell/config checks | SSH/audit scripts pass `bash -n`; `git diff --check` passed. coturn options reviewed against upstream example, not run on a TURN server |

The complete suite and build were rerun after the local runtime and sign-in fixes. Local socket/MySQL tests require execution permission for loopback networking; no tests were silently skipped. Historical-data migration rehearsal, dependency and lockfile checks above were performed on 13 November; no migration file or dependency version changed during the 14 November repair.

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
2. Real authenticated Clerk/browser interactions across two physical devices; microphone/camera/screen permissions, Safari/mobile playback, network handoffs and forced TURN relay. One existing Chrome session authenticated and loaded Chat; a second interactive account was unavailable. The real socket/HTTP integration suite and client unit tests do not prove audiovisual interoperability. No credentials were requested in chat.
3. Representative restored production schema/data, migration lock duration, backup restoration, real Linux FFmpeg performance, load/soak budgets and rollback rehearsal.
4. Group LiveKit capacity and removal/reused-token revocation. Both flags must stay false; initial JWT TTL is not a complete revocation control.
5. Existing social Cloudinary public delivery/unsigned upload policy remains a known privacy boundary outside the new private voice path. An operator must review provider configuration and existing assets before making privacy promises. Existing account deletion/retention policy and legacy social scalability risks are documented in `audit-social.md`.
6. Approved production retention/maintenance scheduling and alerting. The supplied voice retention CLI is a staging rehearsal and cannot silently run against production. No remote jobs, keys, packages or services were installed.

Use `media-test-procedure.md` for the device matrix, `operations.md` for resources/migrations/backups/rollback, and `deployment-access.md` for the minimal secure access setup. Production approval should be requested only after the exact candidate passes staging and the operator has reviewed the release changes.
