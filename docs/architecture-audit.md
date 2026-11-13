# Architecture audit and implementation sequence

## Verified repository state

- Existing Next.js App Router / React / TypeScript app, Clerk identities, MySQL via Prisma 5.22, Cloudinary social media, Google Gemini captions, Google Maps, web-push/PWA. Existing routes and direct conversation/message tables are retained.
- `socket-server.js` is in this repository. The deployed `socket.goga.network` server and CloudPanel are not verifiably the same revision; no remote deployment configuration was retrieved.
- Existing messaging flows: `/chat` -> follower list -> `MainChat` -> Socket.IO -> Message; `getMessages` server action for history; `sharePost` server action previously also emitted `sendMessage`, creating duplicate durable messages.
- Existing socket identity came from untrusted query/payload, with no session verification. Post room joins and typing lacked access checks. Broad Vercel CORS and full message logging were present.
- No migration history, test runner or CI present. `next lint` is invalid for installed Next 16. Manifest, installed dependencies and lockfile needed reconciliation. Baseline `tsc --noEmit` passed before changes.
- `src/components/Post.tsx` had existing user changes and is excluded from our edits.
- Validation uses schema files, mocks, real loopback Socket.IO and a disposable local MySQL 8.4 database. No production database connection, migrations, secrets changes, deployment, service restart, firewall or DNS changes performed.

## Infrastructure constraint supplied by owner

Hostinger KVM 1, Ubuntu 24.04, CloudPanel, 1 vCPU, 4 GB memory, 50 GB disk, 4 TB/month transfer. MySQL shares the VPS. Preserve the existing app, socket process, database and CloudPanel configuration. Initial calls use browser P2P with optional TURN; group LiveKit disabled by default. Watch synchronization carries small control messages, never movie bytes/transcoding.

Read-only SSH attempted using the supplied root target with BatchMode/key authentication and strict host checking. Authentication was rejected. Capacity, actual firewall, ports, process topology and CloudPanel proxy remain **unverified**. Passwords shared in chat were not used or written into files. Run the supplied audit script through an authorized operator session and review sanitized results before infrastructure planning.

## Actionable sequence

1. Secure Clerk socket identity, reconnect refresh, event authorization, input limits, bounded rate limits, privacy/block rules, multi-tab behavior; add behavioral regression tests.
2. Extend existing tables additively for groups, message lifecycle/idempotency and private voice metadata. Keep historical direct rows. Add roles/invites, acknowledgements/retries, read cursors, reactions/replies/edits/deletes and voice recording/playback.
3. Native P2P direct calls with authenticated signaling, short-lived TURN credentials when configured, global ringing UI and media cleanup. Self-hosted LiveKit group transport explicitly gated, scoped short-lived tokens and membership checks.
4. Durable private watch state, ordered compare-and-swap controls, host transfer, reconnect snapshots and client drift correction for explicitly authorized allowlisted URLs.
5. Verify tests/type/lint/build, documented migration baseline reconciliation, staging two-user/browser/media/load tests, rollback and human release review.

## Decisions

- Reuse Clerk, MySQL, Prisma, Socket.IO, Cloudinary and UI palette. No Redis adapter on the single socket process: adding Redis would consume resources without making in-memory coordination safely multi-instance. Scaling requires a separately reviewed shared state/limiter/presence design.
- New voice notes use a private self-hosted filesystem with bounded FFmpeg audio normalization, authenticated range reads, a disk quota and retention. Existing social Cloudinary media remains unchanged. No new paid media service is required. Staging must supply an approved persistent private directory and FFmpeg binaries.
- Self-hosted LiveKit on a separate staging host is preferred for group load measurement. Do not assume spare CPU on this VPS; disable group calls until measured headroom exists.
- For deployment, additive SQL is reviewed first, reconciled against actual schema, applied to disposable staging, then approved with `prisma migrate deploy`. Never `db push` or reset on production.

See `audit-social.md`, `operations.md` and test results for coverage and remaining release gates.
