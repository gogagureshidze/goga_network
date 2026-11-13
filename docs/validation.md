# Validation record — 13 November 2026

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
| `npm test` | 112 passed, zero failed/skipped; actual loopback Socket.IO and FFmpeg tests plus isolated service/client tests |
| `npm run test:integration` | Passed against disposable local MySQL 8.4.9 on `127.0.0.1:33367/goga_validation`; synthetic Alice/Bob/outsider users, eight concurrent duplicate sends, groups/roles, voice ownership/deletion, call/device/outsider checks, watch ordering, blocks and original account deletion restriction |
| Migration deploy | Both migrations applied successfully to empty disposable MySQL |
| Historical-data rehearsal | Applied baseline, inserted synthetic existing users/post/direct conversation/message/media fields, applied expansion; original values and all three RESTRICT foreign keys preserved |
| Schema comparison | Migrated local database matches the Prisma schema: no difference detected. Schema-file diff differs only by explicit drop/recreation of the three preserved RESTRICT constraints; no production introspection used |
| `npm run build` | Passed under Node 24.7 with synthetic Clerk and loopback dummy database configuration; existing and new routes compiled |
| `node scripts/check-build-artifacts.js` | Passed: 28 deployment traces exclude root environment files, private keys and Git metadata |
| Lockfile check | `npm ci --dry-run --ignore-scripts --offline` passed; full clean Linux install is delegated to CI/staging, not claimed executed locally |
| Dependency audit | Zero high/critical; eight moderate advisories remain in minimatch/nodemon/TypeScript ESLint dependency chains. No forced incompatible upgrades applied |
| Shell/config checks | SSH/audit scripts pass `bash -n`; `git diff --check` passed. coturn options reviewed against upstream example, not run on a TURN server |

The first sandboxed socket test invocation could not bind loopback (`EPERM`); the authorized local execution passed. This was an execution restriction, not a skipped test. The complete suite was rerun after the client fixes. The real MySQL suite and build were repeated after preserving foreign-key deletion behavior.

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
2. Real Clerk/browser interactions across two physical devices; microphone/camera/screen permissions, Safari/mobile playback, network handoffs and forced TURN relay. Automated mocks do not prove audiovisual interoperability.
3. Representative restored production schema/data, migration lock duration, backup restoration, real Linux FFmpeg performance, load/soak budgets and rollback rehearsal.
4. Group LiveKit capacity and removal/reused-token revocation. Both flags must stay false; initial JWT TTL is not a complete revocation control.
5. Existing social Cloudinary public delivery/unsigned upload policy remains a known privacy boundary outside the new private voice path. An operator must review provider configuration and existing assets before making privacy promises. Existing account deletion/retention policy and legacy social scalability risks are documented in `audit-social.md`.
6. Approved production retention/maintenance scheduling and alerting. The supplied voice retention CLI is a staging rehearsal and cannot silently run against production. No remote jobs, keys, packages or services were installed.

Use `media-test-procedure.md` for the device matrix, `operations.md` for resources/migrations/backups/rollback, and `deployment-access.md` for the minimal secure access setup. Production approval should be requested only after the exact candidate passes staging and the operator has reviewed the release changes.
