# Private self-hosted voice storage

New voice messages use private files on the Hostinger VPS. This path has no cloud-media API subscription. The existing social-post Cloudinary integration is independent and is unchanged.

The Next.js upload and playback routes must run on a host with the same persistent storage directory. Vercel's ephemeral function filesystem is not suitable. Keep one Next.js process and one Socket.IO process on this 1 vCPU / 4 GB server until staging measurements justify a different topology; media processing has a process-wide concurrency limit of one and returns `VOICE_PROCESSING_BUSY` while occupied.

## Configuration

Set the following on the application server only. No storage path is exposed to the browser.

```dotenv
VOICE_STORAGE_DIR=/srv/goga/private-voice
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
VOICE_STORAGE_QUOTA_BYTES=1073741824
VOICE_STORAGE_RESERVE_BYTES=1073741824
VOICE_STORAGE_MAX_FILES=10000
```

The directory must be an absolute, real path outside the checkout and outside every web server document root or static alias. Symlinked storage paths are rejected. Provision it for the unprivileged application user with mode `0700`; completed and temporary files use `0600`. Confirm CloudPanel/nginx cannot serve this directory. Include its persistent volume and the matching database metadata in encrypted backups. Do not mount it into any public static server.

Install a maintained system FFmpeg/ffprobe package in staging first. The local tests used FFmpeg 8.1. On macOS Homebrew, set the two paths to `/opt/homebrew/bin/ffmpeg` and `/opt/homebrew/bin/ffprobe`. A missing binary fails uploads closed with `VOICE_STORAGE_UNAVAILABLE`.

## Processing and access

- Input is limited to 4 MiB and 120 seconds. Allowed containers are WebM, Ogg, MP4, and WAV with matching signatures.
- FFprobe requires exactly one supported audio stream, one or two channels, and 8–96 kHz source sampling. Video and attachment streams are rejected.
- FFmpeg decodes to mono 48 kHz AAC at 64 kbps in an MP4 container. Normalization strips metadata. The actual output is probed again; browser-supplied duration is not authoritative.
- Browser WebM recordings without a container duration are decoded to a maximum of 121 seconds; an actual duration above 120 seconds is rejected.
- Commands have no shell, only local generated filenames, `file,pipe` protocol and container allowlists, one codec/filter thread, a 32 MiB individual-allocation limit, a 5-second probe timeout, and a 20-second encode timeout. Keep FFmpeg patched and run the app as an unprivileged user.
- Space checks preserve at least the configured disk reserve plus processing headroom. A process-shared quota and file cap refuse further uploads; the app never deletes other user data to make room.
- `/api/chat/media/[id]` authenticates Clerk identity and rechecks current conversation membership, block rules, asset expiry, and message deletion for every request. Unsent previews are visible only to their uploader.
- Playback streams private files through the authorized route, supports one HTTP byte range including suffix ranges, and does not redirect to a public file URL. File descriptors use `O_NOFOLLOW`; range responses carry `private, no-store` and `nosniff` headers.

At 64 kbps, a two-minute recording uses approximately 0.96 MB plus MP4 overhead. The default 1 GiB quota holds roughly one thousand maximum-length recordings; shorter messages use less space. Persistent disk, backups, and VPS egress remain operational costs. No bandwidth or concurrency claim has been validated on the production VPS.

## Retention rehearsal

Unsent uploads expire after 24 hours. Sending extends the asset to 90 days; deleting its message expires it immediately. Authorized playback refuses expired files even before cleanup runs.

The cleanup script **does not load `.env`** and refuses execution unless `DEPLOYMENT_ENV` is `staging`, `development`, or `test`. Point `DATABASE_URL` explicitly at a verified staging database. Dry run is the default:

```sh
DEPLOYMENT_ENV=staging node scripts/prune-voice-media.js
DEPLOYMENT_ENV=staging node scripts/prune-voice-media.js --apply
```

Review the dry-run counts before applying. The script locks each expired metadata row before deleting its file, so an asset whose retention was extended concurrently is preserved. It also removes unreferenced completed files older than 48 hours after checking the database. No production retention job is installed or enabled by this change; operations must review and schedule an equivalent production job separately. After a separate cleanup process frees files, restart the application during a maintenance window to refresh its conservative in-memory quota counters.

## Verified locally and required in staging

Automated tests exercise real FFmpeg audio normalization, malformed and video input rejection, duration limits, durationless WebM, the encode concurrency cap, private permissions, exact Range bytes, symlink rejection, quota/reserve failures, cross-user authorization, persistence-failure cleanup, and retention dry-run/locking behavior. They use temporary files and fake database adapters.

Before enabling uploads in staging: verify the directory is inaccessible from nginx, set an explicit disk quota and alerts, validate Linux FFmpeg codecs and memory use, upload/play/seek from Safari and Chrome with two real Clerk accounts, confirm blocked/removed users cannot fetch ranges, validate backup restoration, and run retention dry run. The local real MySQL migration/transaction suite now passes, including draft ownership, sent-note access, idempotency and deletion. A representative staging database and mobile browser media test remain release requirements.

References: [FFmpeg protocols](https://ffmpeg.org/ffmpeg-protocols.html), [FFprobe options](https://ffmpeg.org/ffprobe.html).
