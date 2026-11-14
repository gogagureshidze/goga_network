# Netlify frontend and private VPS voice API

**Prepared configuration only. Nothing in this runbook has been installed or executed on production.** All package, service, proxy, DNS, TLS and production database changes require the owner's explicit approval. Perform this sequence on isolated staging first. Keep Next.js on Netlify, and keep the existing Hostinger MySQL and Socket.IO services in place.

The commands below assume a **separate isolated staging host**, where the production-style names and paths can safely be rehearsed against a staging database. They are not instructions to place a staging service over production directories on the current VPS. If an approved staging site must share the existing VPS, consistently substitute `/srv/goga/media-staging`, `/srv/goga/private-voice-staging`, `/etc/goga/media-staging.env`, account/unit `goga-media-staging`, and loopback port `3003` in every command, systemd setting and nginx upstream. Use separate staging-only database/Clerk credentials, quota, hostname and nginx zone names. Never share its storage directory with production. Those additional processes still need a capacity review on the 1 vCPU host.

## Architecture and API contract

```text
Netlify Next.js + Clerk browser session
  ├─ existing HTTPS/WSS Socket.IO → existing Hostinger socket process → MySQL
  └─ HTTPS Bearer requests → CloudPanel nginx media hostname
                              → 127.0.0.1:3002 media-server.js
                                ├─ existing Prisma/MediaAsset/Message → MySQL
                                └─ bounded FFmpeg → /srv/goga/private-voice
```

The media process imports the shared `media-policy`, `voice-storage` and conversation authorization modules. It runs separately from Socket.IO, so audio encoding does not block the socket event loop. There is one media process and one encoder slot; do not enable PM2 cluster mode or multiple replicas sharing the directory. The in-memory account limits and storage accounting require a single writer. Socket.IO continues to attach the returned asset ID to a durable message. Existing message IDs, users, URLs stored in message rows and database tables are preserved; this split introduces **no new Prisma migration**. The existing communications schema must already be present. Read-only startup preflight refuses an incompatible schema rather than applying DDL.

| Endpoint | Authentication and behavior |
|---|---|
| `POST /api/chat/voice` | Current Clerk bearer token and allowed browser origin; multipart `audio`, `durationMs`, optional `waveform`, and `conversationId` or `receiverId`. Conversation/privacy/block checks before encoding and again before storing metadata. Returns a draft asset reference, never a permanent public URL. |
| `GET /api/chat/media/:uuid` | Current bearer identity and current conversation authorization. Drafts are uploader-only. Supports one byte range, suffix range, `206` and `416`; complete content is `200`. |
| `HEAD /api/chat/media/:uuid` | Same authorization and headers as playback, without response bytes. |
| `DELETE /api/chat/media/:uuid` | Uploader-only draft cancellation. Attached messages return `409`; delete a sent message through existing Socket.IO controls instead. |
| `GET /health` | Minimal liveness; no credentials or database identifiers. |
| `GET /ready` | Database/storage readiness; keep behind the local-only nginx location. |

The browser obtains the current session token from Clerk and sends `Authorization: Bearer …` with `credentials: omit`. No token belongs in a URL, cookie, localStorage or nginx log. Playback fetches authenticated bounded audio and uses a temporary browser blob URL because an `<audio src>` request cannot set a bearer header. The API still serves HTTP Range to authenticated clients. Signing out/unmounting releases object URLs; bytes already downloaded cannot be remotely recalled. Each new request checks permissions. Tokens are verified with the same Clerk instance as the frontend and Socket.IO, including exact `authorizedParties`; CORS is not a substitute for membership checks. See [Clerk token verification](https://clerk.com/docs/reference/backend/verify-token).

The API accepts at most 4 MiB plus 32 KiB of multipart overhead, while the audio itself is limited to 4 MiB and 120 seconds. The proxy's 5 MiB outer limit permits that bounded envelope. Account upload limits, bounded input parsing and one concurrent encoder reject excess work; nginx adds an independent connection/request ceiling. Audio is normalized to mono 48 kHz AAC/MP4 at 64 kbps. The upload and download paths use HTTPS and `private, no-store`; neither Netlify nor nginx should cache responses. No public static `alias`, bucket, signed permanent URL or Netlify filesystem is used.

## Environment placement

| Where | Required settings | Notes |
|---|---|---|
| Netlify build | `NEXT_PUBLIC_MEDIA_API_URL=https://media.example.test` | Exact public HTTPS media origin, no path or trailing slash. Build a new deploy after changing it. It is intentionally public, unlike credentials. Retain existing `NEXT_PUBLIC_SOCKET_URL` and Clerk publishable key. |
| Netlify server environment | Existing app/database/auth settings | Preserve these for existing social routes. Do not add voice storage paths, FFmpeg or new media API server secrets to Netlify. |
| VPS media service | `NODE_ENV=production`, `DEPLOYMENT_ENV=staging` initially, `MEDIA_API_HOST=127.0.0.1`, `MEDIA_API_PORT=3002` | Production mode also applies on HTTPS staging, so proxy/origin enforcement matches production. |
| VPS media service | `MEDIA_API_PUBLIC_ORIGIN`, `MEDIA_ALLOWED_ORIGINS` | Media origin plus comma-separated **exact app origins**, for example `https://goga.network,https://www.goga.network` only if both actually serve authenticated app sessions. No `*`, paths, unreviewed preview deployments or trailing slash. |
| VPS media service | `DATABASE_URL` | Existing environment-specific MySQL DML user and database. Start with `connection_limit=2&pool_timeout=10` and measure total connections with existing services. No migration privilege is needed for this API. |
| VPS media service | `CLERK_SECRET_KEY` or optional `CLERK_JWT_KEY` | Same Clerk instance as the corresponding app. Secrets remain server-side. A pinned JWT public key needs a rotation procedure. No webhook secret is needed by this API. |
| VPS media service | `VOICE_STORAGE_DIR=/srv/goga/private-voice`, `FFMPEG_PATH=/usr/bin/ffmpeg`, `FFPROBE_PATH=/usr/bin/ffprobe` | Private persistent storage on the VPS; absolute paths, no symlinks or webroot. |
| VPS media service | `VOICE_STORAGE_QUOTA_BYTES=1073741824`, `VOICE_STORAGE_RESERVE_BYTES=1073741824`, `VOICE_STORAGE_MAX_FILES=10000` | Conservative 1 GiB initial quota plus 1 GiB minimum disk reserve. Check actual free space before use. |

The frontend configuration is compiled into its build. Set it through the existing Netlify project settings for the relevant context, then create a reviewed candidate deploy. Preserve all existing Netlify secrets and application routing. Scope previews to a separate staging API/database/Clerk instance; do not allow every `*.netlify.app` deployment. [Netlify environment configuration](https://docs.netlify.com/build/configure-builds/environment-variables/).

The service environment example is [`ops/goga-media.env.example`](../ops/goga-media.env.example). It is an inventory with placeholders, not usable credentials. `systemd` reads `/etc/goga/media.env`; the API does not discover a production `.env` itself. Put real values into that file through an approved secure editor/secret mechanism. Do not source it in shell or print it in diagnostics. Keep it `root:root`, mode `0600`. [systemd environment and filesystem controls](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html).

## 1. Review prerequisites without changes

Use the approved SSH alias and an existing key/agent. Do not use passwords pasted in conversation. An administrator must supply the approved deployment account, verified host key, staging hostname, isolated staging database and Clerk development keys. Review `scripts/read-only-vps-audit.sh` output privately. Record the current socket/CloudPanel release and backups. Verify Node, FFmpeg, port availability and systemd version without restarting anything:

```sh
node --version
command -v node
command -v ffmpeg
command -v ffprobe
systemd --version
ss -lnt '( sport = :3002 )'
df -h /srv
free -m
```

Use maintained Node **24.x**, consistent with CI. The unit template assumes `/usr/bin/node`; if the approved runtime is elsewhere, edit that one path before installation and ensure it is outside a user home blocked by `ProtectHome`. Never replace CloudPanel's Node executable or global runtime. Node supports explicit external env-file loading for a manual staging run, but the managed service uses `EnvironmentFile` instead. [Node 24 command-line documentation](https://nodejs.org/docs/latest-v24.x/api/cli.html#--env-filefile).

If FFmpeg is absent, this is a separate approved staging package change, not a prerequisite performed automatically:

```sh
sudo apt-get update
sudo apt-get install --no-install-recommends ffmpeg
/usr/bin/ffmpeg -version
/usr/bin/ffprobe -version
```

Rehearse the distro codec build with the real upload suite. Do not perform a broad system upgrade or install FFmpeg on production until the package change is approved. If Node 24 is absent, have the administrator install an approved separately located runtime; do not run an unreviewed remote installer script.

## 2. Produce a Linux artifact off the VPS

Use a clean Ubuntu 24.04 CI/staging checkout of the exact reviewed commit. These commands are for that disposable builder, **not the production checkout**. They generate Prisma client code without connecting to MySQL; they do not apply migrations. Run the full repository checks before packaging. Build the Next.js frontend in Netlify's existing pipeline, not on the 1 vCPU VPS.

```sh
set -eu
GOGA_RELEASE_COMMIT='REPLACE_WITH_REVIEWED_40_CHARACTER_COMMIT'
test "${#GOGA_RELEASE_COMMIT}" -eq 40
case "$GOGA_RELEASE_COMMIT" in *[!0-9a-f]*) exit 1 ;; esac
test "$(git rev-parse HEAD)" = "$GOGA_RELEASE_COMMIT"
test -z "$(git status --porcelain)"
node --version
npm ci
npm run typecheck
npm run lint
npm test
# The exact commit must also pass the disposable MySQL service-container suites
# in .github/workflows/ci.yml. The Mac-specific local ownership wrapper is not
# interchangeable with that CI container; use the existing CI integration steps.
npm run build
npm prune --omit=dev --ignore-scripts
tar -czf "/tmp/goga-media-${GOGA_RELEASE_COMMIT}.tgz" \
  package.json package-lock.json media-server.js server src/generated/prisma \
  scripts/prune-voice-media.js node_modules ops
sha256sum "/tmp/goga-media-${GOGA_RELEASE_COMMIT}.tgz" > "/tmp/goga-media-${GOGA_RELEASE_COMMIT}.tgz.sha256"
```

Check archive contents and checksum in the release review. The explicit file list excludes `.env*`, `.local`, `.next`, private recordings, keys and browser fixtures. `node_modules` is built on Linux with the committed lockfile; do not upload macOS Prisma binaries. No new database copy or migration is necessary for this architecture change. If the previous communications migration is absent, stop and use the separately reviewed baseline/migration procedure in [operations](operations.md), first against an approved isolated clone.

Transfer the reviewed archive through the approved account into its private incoming directory. For example, after the operator sets `GOGA_RELEASE_COMMIT`, `GOGA_SSH_ALIAS` and a verified writable `GOGA_INCOMING` path:

```sh
scp "/tmp/goga-media-${GOGA_RELEASE_COMMIT}.tgz" "${GOGA_SSH_ALIAS}:${GOGA_INCOMING}/"
```

Verify the expected SHA-256 obtained from the trusted build log on the destination. Do not trust only a checksum copied alongside an untrusted archive. Never transfer environment files through the artifact.

## 3. Provision the isolated staging service after approval

The following is the proposed **new media service namespace on the separate staging host**, not the existing socket release or a path to reuse on a production host. An administrator runs these only after reviewing names, storage and permissions. If any target already exists, inspect and adapt; do not overwrite it blindly. Before production rollout, inventory existing `MediaAsset` rows and their backing files through an approved operator session: the metadata alone does not prove that a recording still exists. Existing recordings require a separately approved, checksum-verified offline copy to the new directory before switching readers. Preserve original filenames/UUIDs and matching metadata; never regenerate, reseed or silently erase unavailable assets. Test representative old notes through the new API. If prior ephemeral storage lost files, restore them from a verified backup or report that limitation before release.

```sh
# New account only; do not alter an existing same-named account.
getent passwd goga-media || sudo useradd --system --user-group --home-dir /nonexistent --no-create-home --shell /usr/sbin/nologin goga-media
sudo install -d -o root -g root -m 0755 /srv/goga/media /srv/goga/media/releases
sudo install -d -o goga-media -g goga-media -m 0700 /srv/goga/private-voice
sudo install -d -o root -g root -m 0700 /etc/goga
```

Do not make the service user own release code or grant it sudo. `/srv/goga/private-voice` is its only durable writable location. The following installs a verified artifact in a new immutable release directory; set the two required variables to approved values on the target first:

```sh
set -eu
: "${GOGA_RELEASE_COMMIT:?Set the reviewed 40-character commit}"
: "${GOGA_INCOMING:?Set the approved incoming directory}"
test "${#GOGA_RELEASE_COMMIT}" -eq 40
case "$GOGA_RELEASE_COMMIT" in *[!0-9a-f]*) exit 1 ;; esac
GOGA_RELEASE_DIR="/srv/goga/media/releases/${GOGA_RELEASE_COMMIT}"
test ! -e "$GOGA_RELEASE_DIR"
sudo install -d -o root -g root -m 0755 "$GOGA_RELEASE_DIR"
sudo tar --extract --gzip --file "${GOGA_INCOMING}/goga-media-${GOGA_RELEASE_COMMIT}.tgz" \
  --directory "$GOGA_RELEASE_DIR" --no-same-owner --no-same-permissions
sudo chown -R root:root "$GOGA_RELEASE_DIR"
sudo chmod -R go-w "$GOGA_RELEASE_DIR"
test ! -e /etc/goga/media.env
sudo install -o root -g root -m 0600 "$GOGA_RELEASE_DIR/ops/goga-media.env.example" /etc/goga/media.env
sudoedit /etc/goga/media.env
test ! -e /etc/systemd/system/goga-media.service
sudo install -o root -g root -m 0644 "$GOGA_RELEASE_DIR/ops/goga-media.service.example" /etc/systemd/system/goga-media.service
sudoedit /etc/systemd/system/goga-media.service
sudo systemd-analyze verify /etc/systemd/system/goga-media.service
test ! -e /srv/goga/media/current
sudo ln -s "$GOGA_RELEASE_DIR" /srv/goga/media/current
sudo systemctl daemon-reload
sudo systemctl start goga-media
sudo systemctl status goga-media --no-pager
curl --fail --silent --show-error http://127.0.0.1:3002/health
curl --fail --silent --show-error http://127.0.0.1:3002/ready
```

`start` here is an approved staging action; it is deliberately separate from enabling automatic startup. The unit bounds the whole Node/Prisma/FFmpeg process group to 50% of one CPU, 384 MiB memory pressure and 512 MiB hard memory limit. These are initial containment settings, not measured production capacity. Resource-limited encoding still has the application's 20-second timeout; verify two-minute inputs complete under this limit before rollout. The unit uses a read-only filesystem apart from the private media directory and private temporary files. [systemd resource controls](https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html).

## 4. Add a dedicated HTTPS proxy without changing the app/socket sites

In CloudPanel, an approved administrator provisions the chosen **media hostname only**, its DNS and a valid certificate using the existing certificate/renewal workflow. No DNS or firewall command is assumed here: the live inventory is unavailable. Keep the existing Next.js custom domain pointing at Netlify. Keep the existing socket domain/vhost unchanged. No public port 3002 or extra firewall opening is needed; only the existing HTTPS listener proxies to loopback.

Review [`ops/goga-media-limits.nginx.conf.example`](../ops/goga-media-limits.nginx.conf.example) in the existing nginx `http` context, and merge [`ops/goga-media-proxy.nginx.conf.example`](../ops/goga-media-proxy.nginx.conf.example) into the new media site's HTTPS `server` block through CloudPanel's supported vhost editor. Preserve certificate paths, renewal/ACME locations and HTTP-to-HTTPS redirect. Do not replace global `nginx.conf`, create a second conflicting `location /`, or copy TLS paths from an unrelated site. The exact CloudPanel-managed file path must come from the read-only audit; no guessed path is safe to overwrite.

The proxy forwards bearer and Range headers, overwrites forwarding metadata, removes cookies, disables buffering/caching and uses a 5 MiB body limit. Its dedicated CloudPanel `server_name` selects the media hostname. The API checks `Host` against `MEDIA_API_PUBLIC_ORIGIN`, enforces `X-Forwarded-Proto: https` and exact origin/Clerk authorized party; it binds loopback only and does not construct redirects from `Host`. The 10 requests/second IP ceiling with burst 30 and 64 total active requests is a starting abuse bound; per-account upload policy is stricter. The API owns CORS so rejection responses stay consistent, with no wildcard/credential-sharing policy. See [nginx body limits](https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size), [proxy streaming](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_request_buffering), [request limiting](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html) and [connection limiting](https://nginx.org/en/docs/http/ngx_http_limit_conn_module.html).

After backing up the exact changed config, an authorized operator validates and gracefully reloads nginx **only if validation succeeds**:

```sh
sudo nginx -t
# Run only after nginx -t succeeds and the approved vhost diff is reviewed.
sudo systemctl reload nginx
```

Use the approved real values in the following HTTPS checks. Expected results: health `200`; allowed preflight with exact origin and only required methods/headers; unapproved origin denied; unauthenticated audio request `401`; `/srv/goga/private-voice/...` and arbitrary paths `404`.

```sh
: "${GOGA_MEDIA_ORIGIN:?Set approved HTTPS media origin}"
: "${GOGA_APP_ORIGIN:?Set exact staging app origin}"
curl --fail --silent --show-error "${GOGA_MEDIA_ORIGIN}/health"
curl --silent --show-error --include --request OPTIONS "${GOGA_MEDIA_ORIGIN}/api/chat/voice" \
  --header "Origin: ${GOGA_APP_ORIGIN}" \
  --header 'Access-Control-Request-Method: POST' \
  --header 'Access-Control-Request-Headers: authorization,content-type'
curl --silent --show-error --include "${GOGA_MEDIA_ORIGIN}/api/chat/media/00000000-0000-4000-8000-000000000000" \
  --header "Origin: ${GOGA_APP_ORIGIN}"
```

Do not paste bearer tokens into shell history for positive tests. Use the signed-in staging browser and inspect status/header names without copying authorization values. Confirm no CDN, CloudPanel cache or service worker caches these routes. Access logging is disabled in the media snippets, but inherited nginx/CloudPanel **error logs can still include a request URI on early proxy failures**, including a maliciously supplied query string. Review those log destinations, access controls, retention and redaction; never assume `access_log off` sanitizes all proxy diagnostics. The application itself never creates token-bearing URLs and rejects query parameters. If nginx rejects oversized bodies before the app, the browser may show a generic network/CORS error; the client enforces the smaller audio limit before upload, and adversarial tests should still confirm nginx's `413`.

## 5. Staging acceptance and production approval gate

- [ ] Exact candidate commit passed typecheck, lint, unit tests, guarded MySQL integrations and Netlify production build. Linux FFmpeg behavior was validated separately from macOS.
- [ ] Next.js remains on Netlify. Its build points at the isolated staging API, which points only at staging MySQL and the same development Clerk instance.
- [ ] Alice uploads, previews and cancels a draft; Bob and outsider Carol cannot play/delete that draft. Sending attaches it once through Socket.IO; Alice and Bob play/seek after refresh, Carol is denied. Deleting a sent message denies subsequent full and Range reads. Direct DELETE of an attached asset is rejected.
- [ ] Expired/tampered/wrong-party token, missing bearer, cookie-only and query-token requests fail. Allowed origin succeeds; unexpected origin, wildcard, HTTP production transport and forged forwarding inputs fail. Range/HEAD/416, upload size/type/duration, throttling, aborted requests and busy encoder tests passed.
- [ ] Removal/blocking during upload denies attachment and cleans temporary files. Removal/blocking after sending denies each new playback request. Application logs contain no private filenames/credentials; proxy error-log exposure, access controls and redaction are explicitly reviewed with adversarial query tests.
- [ ] Real Chrome, Firefox, Safari and representative mobile browsers recorded/uploaded/played authenticated notes with two real Clerk accounts. Test account switch/sign-out while requests are pending, retries, mobile interruption and repeated seeks.
- [ ] Existing text chat, groups, social feed and WebRTC signaling remain functional while a maximum-length note encodes. No new socket restart or protocol replacement is needed for the media split.
- [ ] Load test uploads plus ordinary social/MySQL/socket traffic under the proposed unit limits; monitor wall time, CPU, RSS, event-loop lag, DB connections, disk and `429/503/507`. No sustained swap/OOM, at least 750 MiB available system memory and 20% free disk. Group LiveKit stays disabled.
- [ ] Matching database/files backup restored successfully to an isolated host. Retention policy/job, quota alerts, certificate renewal, monitoring and rollback were approved.
- [ ] Human approves the exact release commit, package/service/proxy changes, environment values, any existing-file transfer and the Netlify deploy. No production DDL is included in this architecture change.

Budget an initial 128–256 MiB resident media process plus transient encoding within the 512 MiB service ceiling; measure rather than assume this on the VPS. At 64 kbps, 1,000 two-minute notes use about 0.96 GB before container/backup overhead; 10,000 such downloads are about 9.6 GB of outbound data. Existing MySQL, CloudPanel, sockets and optional TURN consume the remaining resources. Self-hosting avoids a new paid media API, but disk, backups and VPS bandwidth still cost resources.

After all gates pass and production is explicitly approved, repeat the reviewed provisioning sequence using **production** origins/Clerk/DATABASE_URL and `DEPLOYMENT_ENV=production`. Do not reuse staging credentials. Bring up the media service/proxy first; then release the Netlify candidate with its production media origin. Smoke test with authorized accounts, then enable the reviewed service at boot:

```sh
sudo systemctl enable goga-media
```

## Backups, deletion and rollback

Use the existing encrypted MySQL backup system and an encrypted off-VPS backup of `/srv/goga/private-voice`. Record commit, schema state, snapshot time, owner/modes, file count and checksums in private operational records. For a consistent logical backup, enter an approved maintenance window that pauses voice uploads, draft deletion, socket attachment/message deletion and retention, then back up DB plus files. Alternatively rehearse a coordinated snapshot mechanism. A DB-only backup cannot restore recordings; a file-only backup cannot restore permissions/ownership. Do not publish backup archives or copy them into Netlify.

Unsent drafts expire after 24 hours; sent notes after 90 days; message deletion makes playback inaccessible immediately. The draft endpoint removes its private file and metadata. Expired sent files require the reviewed retention job; the existing `voice:prune` CLI intentionally refuses `DEPLOYMENT_ENV=production` and remains a **staging rehearsal**, not an installed production cron job. Do not mislabel production as staging to bypass that safeguard. Approve a production cleanup job separately and include it in the release checklist. Until then, expired bytes stay private and consume quota; uploads fail closed at quota. Restart the media service in its maintenance window after a separate cleanup process changes disk contents so conservative in-memory quota accounting is refreshed.

Keep the previous **compatible** media artifact and Netlify deploy. For a media-only failure, keep Socket.IO/MySQL running, temporarily disable the affected media proxy route or leave the frontend's actionable media error, and roll back the service to the previous reviewed media artifact. Never roll voice playback back to Netlify's ephemeral filesystem. The first standalone-API release has no previous compatible API; its fallback is disabling voice uploads/playback until fixed, preserving data and all unrelated messaging.

For a subsequent approved media rollback on the VPS:

```sh
set -eu
: "${GOGA_PREVIOUS_COMMIT:?Set a reviewed compatible previous media commit}"
test "${#GOGA_PREVIOUS_COMMIT}" -eq 40
case "$GOGA_PREVIOUS_COMMIT" in *[!0-9a-f]*) exit 1 ;; esac
GOGA_PREVIOUS_DIR="/srv/goga/media/releases/${GOGA_PREVIOUS_COMMIT}"
test -f "$GOGA_PREVIOUS_DIR/media-server.js"
test ! -e /srv/goga/media/current.next
sudo ln -s "$GOGA_PREVIOUS_DIR" /srv/goga/media/current.next
sudo mv -Tf /srv/goga/media/current.next /srv/goga/media/current
sudo systemctl restart goga-media
curl --fail --silent --show-error http://127.0.0.1:3002/ready
```

Restore only the reviewed media vhost diff if necessary, run `nginx -t`, then gracefully reload. Do not revert the app/socket vhosts or CloudPanel globally. Roll back the Netlify candidate only to a release compatible with the same private API configuration. **Do not drop tables, reverse migrations, delete recordings or restore an older database as a routine rollback.** Database restoration is a separately approved incident action that can lose later writes. Keep the failed release and sanitized logs for diagnosis.
