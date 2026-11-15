# Call and inbox candidate file inventory

Working-tree changes on `fix/call-screen-audio-fullscreen-camera-state`, recorded 15 November 2026. This includes the preserved interrupted work plus its completion; it is not a pushed release. `Post.tsx` has no new diff. Generated clients, local environment files, test databases and build output are ignored and must not be included in a release artifact.

Deployment scope, validation and rollback are documented in [CALL-INBOX-RELEASE.md](CALL-INBOX-RELEASE.md) and [validation.md](validation.md). Shared room/chat modules are also bundled by authenticated Netlify routes; the VPS patch list remains deliberately restricted.

## Netlify application

```text
src/actions/activityActions.ts
src/app/api/calls/[id]/token/route.ts
src/app/api/webhooks/clerk/route.ts
src/app/chat/page.tsx
src/app/settings/page.tsx
src/components/ChatListDesktop.tsx
src/components/MainChat.tsx
src/components/chat/GroupConversations.tsx
src/components/communications/CallRoom.tsx
src/components/communications/CommunicationsProvider.tsx
src/components/communications/GroupCall.tsx
src/components/communications/PeerCall.tsx
src/components/communications/types.ts
src/lib/activity-client.ts
src/lib/call-server.ts
src/lib/chat-inbox.ts
src/lib/group-call-state.ts
src/lib/peer-ice.ts
src/lib/peer-media.ts
```

## Shared server modules and VPS Socket.IO

```text
server/call-credentials.js
server/chat-service.js
server/db-preflight.js
server/rooms.js
server/socket-app.js
socket-server.js
```

## Database schema and migration

```text
prisma/migrations/20261115000000_group_media_leases/migration.sql
prisma/schema.prisma
```

## Regression tests and CI

```text
.github/workflows/ci.yml
scripts/dev-integration.js
tests/activity-client.test.cjs
tests/activity-privacy.test.cjs
tests/call-media.integration.cjs
tests/call-tokens.test.js
tests/chat-inbox.test.cjs
tests/chat-service.test.js
tests/clerk-webhook.test.cjs
tests/group-call-state.test.cjs
tests/group-calls.integration.cjs
tests/helpers/chat-fixture.js
tests/helpers/runtime-harness.cjs
tests/inbox.integration.cjs
tests/livekit-sfu.integration.cjs
tests/peer-ice.test.cjs
tests/peer-media.test.cjs
tests/rooms.test.js
tests/socket.test.js
```

## Environment templates, operations and documentation

```text
.env.example
docs/CALL-INBOX-FILES.md
docs/CALL-INBOX-RELEASE.md
docs/GROUP-CALLS.md
docs/TURN-VALIDATION.md
docs/calling-security.md
docs/media-test-procedure.md
docs/validation.md
ops/coturn.conf.example
ops/livekit.local-test.yaml
```
