# Calls, activity privacy and inbox release

Branch: `fix/call-screen-audio-fullscreen-camera-state`. Next.js stays on Netlify. MySQL, Socket.IO and the existing private voice API stay on Hostinger. This is an operator runbook, **not evidence of deployment**. No production access, infrastructure changes, push or merge was performed.

Review the [complete changed-file inventory](CALL-INBOX-FILES.md) and [recorded test results](validation.md) with this runbook.

## Release components

| Target | Changes |
| --- | --- |
| Netlify | P2P microphone plus tab audio, camera-off placeholders, fullscreen/expanded layouts; three-person LiveKit UI and token API; ICE renewal/diagnostics; unified realtime inbox, durable unread indicators and privacy settings; verified Clerk deletion atomically retires call rooms before participant cascades. |
| Hostinger Socket.IO | Authorized media-state signaling, group admission/screen leases/room retirement, conversation-scoped presence, activity preference updates and inbox summaries. Existing owner-supplied PM2 process: **socket-v2**, loopback **3001**. |
| MySQL | One new additive migration: **20261115000000_group_media_leases**. Adds seven CallSession columns, two unique indexes and RetiredMediaRoom. No user/message deletion, reset or data copy. |
| Existing voice service | No media endpoint, private-storage or FFmpeg deployment required. **Do not restart goga-media.service.** |
| LiveKit / TURN | No production installation/configuration change is authorized. Group flags remain false pending the separate security, device and capacity gates. No new application package dependency. |

Old clients retain existing event contracts. Deploy schema first, Socket.IO second, then the matching Netlify build. New Prisma queries require the added columns even with groups disabled. Drain active calls before the socket restart; do not promise uninterrupted calls during deployment. Keep a single Socket.IO instance: adding PM2 clustering requires separate shared state/adapter work.

Clerk deletion uses the shared room service from the Netlify webhook. Tombstones and room rotations commit in MySQL before account deletion; Socket.IO's cleanup sweeper and clients' five-second state reconciliation recover across process boundaries. Existing restrictive foreign keys are preserved: a blocked deletion returns a retryable failure and rolls back rather than deleting historical messages. Include verified webhook retry, concurrent call initiation and room convergence in staging checks.

## Configuration and access

Preserve existing Clerk identities/keys, MySQL access, exact allowed origins and `NEXT_PUBLIC_MEDIA_API_URL`. Netlify's `NEXT_PUBLIC_SOCKET_URL` continues pointing at the existing HTTPS socket origin. Never configure private filesystem storage or FFmpeg on Netlify.

- Group values, room isolation and capacity requirements: [GROUP-CALLS.md](GROUP-CALLS.md).
- Temporary TURN credentials, UDP/TCP/TLS ports and staging-only `NEXT_PUBLIC_RTC_FORCE_RELAY`: [TURN-VALIDATION.md](TURN-VALIDATION.md).
- Local launchers and fixtures: [LOCAL-DEVELOPMENT.md](LOCAL-DEVELOPMENT.md).

Minimal one-time operator setup: a key-authenticated SSH alias for the existing deployment/site user; confirmation of the actual socket working directory and PM2 owner; a private incoming/backup directory; access to the existing Netlify site; and an existing secure MySQL migration/backup credential on the VPS. Do not paste passwords/tokens into chat. Previously exposed credentials must be replaced by the owner through the provider's secure controls before use. No broad root access or permission to modify the blog/media services is needed for this release.

Inside an **authorized** SSH session, inspect only non-secret process metadata:

```sh
node --version
ss -lntp '( sport = :3001 )'
readlink -f "/proc/${GOGA_SOCKET_PID:?Set the verified listening PID}/exe"
readlink -f "/proc/${GOGA_SOCKET_PID}/cwd"
# Run only under the existing PM2 owner, not root or an unrelated user.
pm2 ls
pm2 describe socket-v2
```

Do not print environment dumps or secret files. Require the existing PM2 watch/autoreload setting to be off before patching. Directory, owner and live migration history were **not independently verified** from this workspace; set the variables below from the read-only audit rather than guessing a CloudPanel path.

## Before production approval

1. Run all automated checks and the real-device staging matrix. The local SFU test proves generated-media transport and source restrictions; it does not prove browser capture, TURN or Hostinger capacity.
2. Rehearse the additive migration on an isolated copy of the deployed schema using synthetic/sanitized data. Check every pending migration, ALTER lock duration and backup restoration. Do not automatically baseline existing tables or apply earlier migrations to a populated production schema.
3. Record the reviewed commit, Netlify deploy ID, old socket release, artifact SHA-256 and exact restart window. Verify the current socket deployment is compatible with this repository's base and installed packages. If it is a separate/older server, do not overlay these modules; rehearse its existing full-release pipeline first.
4. Verify the existing encrypted backup/restore workflow. Use a privately configured `mysql_config_editor` login path or equivalent secret store; no password on a command line. Back up database plus release files, preserve recordings, and verify restore in isolation. A code rollback must never restore an old database over new messages.
5. Obtain explicit human approval for the exact candidate and target. No push/merge, Netlify publication, production migration or restart occurs automatically from this task.

## Exact operator commands after staging and approval

Package the reviewed, committed branch on the development/CI machine. These commands do not push; publication still requires explicit approval:

```sh
set -eu
GOGA_RELEASE_COMMIT='REPLACE_WITH_REVIEWED_40_CHARACTER_COMMIT'
test "${#GOGA_RELEASE_COMMIT}" -eq 40
case "$GOGA_RELEASE_COMMIT" in *[!0-9a-f]*) exit 1 ;; esac
test "$(git rev-parse HEAD)" = "$GOGA_RELEASE_COMMIT"
test "$(git branch --show-current)" = 'fix/call-screen-audio-fullscreen-camera-state'
test -z "$(git status --porcelain)"
git archive --format=tar.gz --output="/tmp/goga-calling-${GOGA_RELEASE_COMMIT}.tgz" \
  "$GOGA_RELEASE_COMMIT" socket-server.js server/chat-service.js server/socket-app.js \
  server/rooms.js server/call-credentials.js server/db-preflight.js prisma/schema.prisma prisma/migrations
shasum -a 256 "/tmp/goga-calling-${GOGA_RELEASE_COMMIT}.tgz"
: "${GOGA_SSH_ALIAS:?Set the approved key-authenticated SSH alias}"
: "${GOGA_INCOMING:?Set the verified private incoming directory}"
scp "/tmp/goga-calling-${GOGA_RELEASE_COMMIT}.tgz" "${GOGA_SSH_ALIAS}:${GOGA_INCOMING}/"
```

On the VPS, under the existing site/deployment user, in **bash**:

```bash
set -euo pipefail
umask 077
: "${GOGA_SOCKET_DIR:?Set the verified existing socket directory}"
: "${GOGA_INCOMING:?Set the approved private incoming directory}"
: "${GOGA_RELEASE_COMMIT:?Set the reviewed commit}"
: "${GOGA_ARTIFACT_SHA256:?Set the trusted artifact checksum}"
test "${#GOGA_RELEASE_COMMIT}" -eq 40
case "$GOGA_RELEASE_COMMIT" in *[!0-9a-f]*) exit 1 ;; esac
test "${#GOGA_ARTIFACT_SHA256}" -eq 64
case "$GOGA_ARTIFACT_SHA256" in *[!0-9a-f]*) exit 1 ;; esac
test -f "$GOGA_SOCKET_DIR/socket-server.js"
test -f "$GOGA_SOCKET_DIR/node_modules/prisma/build/index.js"
GOGA_ARCHIVE="$GOGA_INCOMING/goga-calling-${GOGA_RELEASE_COMMIT}.tgz"
test "$(sha256sum "$GOGA_ARCHIVE" | cut -d ' ' -f 1)" = "$GOGA_ARTIFACT_SHA256"
GOGA_PATCH="$GOGA_INCOMING/calling-${GOGA_RELEASE_COMMIT}"
GOGA_BACKUP="$GOGA_INCOMING/socket-before-${GOGA_RELEASE_COMMIT}.tgz"
test ! -e "$GOGA_PATCH"
test ! -e "$GOGA_BACKUP"
mkdir -m 0700 "$GOGA_PATCH"
tar -xzf "$GOGA_ARCHIVE" -C "$GOGA_PATCH" --no-same-owner --no-same-permissions
for GOGA_FILE in socket-server.js server/chat-service.js server/socket-app.js server/rooms.js server/call-credentials.js server/db-preflight.js; do
  test -f "$GOGA_SOCKET_DIR/$GOGA_FILE"
  node --check "$GOGA_PATCH/$GOGA_FILE"
done
tar -czf "$GOGA_BACKUP" -C "$GOGA_SOCKET_DIR" \
  socket-server.js server/chat-service.js server/socket-app.js server/rooms.js \
  server/call-credentials.js server/db-preflight.js prisma/schema.prisma src/generated/prisma
# Existing approved backup credential only. Do not create/use a root password here.
: "${GOGA_DATABASE_NAME:?Set the verified existing database name}"
mysqldump --login-path=goga-release --single-transaction --no-tablespaces \
  "$GOGA_DATABASE_NAME" | gzip > "$GOGA_INCOMING/database-before-${GOGA_RELEASE_COMMIT}.sql.gz"
# Transfer this private backup through the existing encrypted backup workflow
# and verify an isolated restore BEFORE continuing. Do not copy it into the repo.
```

After the backup verification and approved drained maintenance window, install the reviewed schema/migration files. The existing deployment's secure database environment must already be selected; do not copy local `.env.local` or test settings to production:

```bash
cd "$GOGA_SOCKET_DIR"
install -m 0644 "$GOGA_PATCH/prisma/schema.prisma" prisma/schema.prisma
# Confirm all preceding migrations match the existing deployed history.
for GOGA_MIGRATION in prisma/migrations/*; do
  diff -qr "$GOGA_MIGRATION" "$GOGA_PATCH/$GOGA_MIGRATION"
done
for GOGA_MIGRATION in "$GOGA_PATCH"/prisma/migrations/*; do
  GOGA_MIGRATION_NAME="$(basename "$GOGA_MIGRATION")"
  if [ "$GOGA_MIGRATION_NAME" != '20261115000000_group_media_leases' ]; then
    diff -qr "$GOGA_MIGRATION" "prisma/migrations/$GOGA_MIGRATION_NAME"
  fi
done
# Any differing/missing earlier migration aborts this procedure.
test ! -e prisma/migrations/20261115000000_group_media_leases
mkdir -m 0755 prisma/migrations/20261115000000_group_media_leases
install -m 0644 "$GOGA_PATCH/prisma/migrations/20261115000000_group_media_leases/migration.sql" \
  prisma/migrations/20261115000000_group_media_leases/migration.sql
node node_modules/prisma/build/index.js migrate status
# STOP unless this reports only the reviewed migration pending on the intended DB.
node node_modules/prisma/build/index.js migrate deploy
node node_modules/prisma/build/index.js generate
for GOGA_FILE in socket-server.js server/chat-service.js server/socket-app.js server/rooms.js server/call-credentials.js server/db-preflight.js; do
  install -m 0644 "$GOGA_PATCH/$GOGA_FILE" "$GOGA_FILE"
done
# Preserve existing production environment; no --update-env and no restart all.
pm2 restart socket-v2
curl --fail --silent --show-error http://127.0.0.1:3001/health
curl --fail --silent --show-error http://127.0.0.1:3001/ready
```

These are deliberate operator checkpoints, not a paste-and-run unattended deployment script. A failed migration must be investigated; never use `db push`, `migrate reset` or blind `migrate resolve`. No Next.js build/install runs on the 1 vCPU VPS, and no dependency upgrade is required. If the existing generated-client location or installed Prisma version differs, stop and adapt the release in staging.

Then publish the approved Netlify candidate for the same commit through the existing Git/Netlify pipeline. Verify production context, site and deploy ID; do not upload `.next` manually or automatically push `main`. Keep group flags false. Enabling them later is a separate reviewed infrastructure/capacity change, with matching server-only settings on Netlify and Socket.IO.

**Do not restart or modify:** **gogablog-api**, legacy PM2 **socket**, **goga-media.service**, MySQL/MariaDB, CloudPanel, nginx, coturn, Redis, any other PM2 app or the VPS. No proxy change is needed for this code release. No LiveKit service is installed/restarted. Next.js remains on Netlify.

## Rollback

Republish the previous successful Netlify deploy first. Leave additive database columns/table in place. If the backend also needs rollback, drain calls and restore only the verified code/schema/generated-client backup under the same PM2 owner:

```bash
set -euo pipefail
: "${GOGA_BACKUP:?Set the verified private release backup}"
: "${GOGA_SOCKET_DIR:?Set the same verified socket directory}"
test -f "$GOGA_BACKUP"
tar -xzf "$GOGA_BACKUP" -C "$GOGA_SOCKET_DIR" --no-same-owner
pm2 restart socket-v2
curl --fail --silent --show-error http://127.0.0.1:3001/health
curl --fail --silent --show-error http://127.0.0.1:3001/ready
```

Do not delete the applied migration, reverse its SQL, restore an old database, remove recordings or change unrelated services. New preferences/read receipts are compatible with the previous schema. If groups were separately enabled, disable admission and drain them before rollback; preserve tombstones and arrange continued retired-room cleanup in that separate change plan.

## Release checklist

- [ ] Exact candidate passes TypeScript, lint, unit tests, isolated MySQL integration, optional real SFU test and production build.
- [ ] Two-account privacy/unread tests across tabs/devices; no unread clearing in hidden or obscured views; latest-message ordering and reconnect persistence verified.
- [ ] Two-device P2P mic/camera/tab audio, capture cancellation, fullscreen/mobile, device switch, forced UDP/TCP/TLS relay and long-call credential renewal pass.
- [ ] Existing feed, posts, stories, profiles/followers, group/direct messaging, private voice upload/playback and watch parties pass staging regression.
- [ ] Reviewed migration history, backup/isolated restore, ALTER timing, health checks, previous deploy and rollback rehearsal recorded.
- [ ] Three-person group media, malicious source publication, room rotation, lease races, cleanup outage and real-device matrix pass before enabling group flags.
- [ ] Hostinger baseline/capacity/admission budgets approved; HTTPS/ports/firewall audited read-only; no existing 443 service displaced.
- [ ] Human explicitly approves the commit, migration, target, restart and Netlify publication.

See [Netlify deploy management](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/) and [PM2 single-process management](https://pm2.keymetrics.io/docs/usage/process-management/).
