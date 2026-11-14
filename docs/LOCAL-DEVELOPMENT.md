# Local runtime recovery and daily workflow

The supported development workflow **never uses the remote database in the original `.env`**. It uses dedicated MySQL 8.4 on loopback port **33367**, `goga_development` for the UI and `goga_validation` for disposable integration tests. Production data is neither copied nor modified. Populate representative local content after signing in with `npm run dev:fixtures` below.

## Start

Prerequisites: Node 24 LTS (or Node 22.13+), MySQL 8.4 binaries, FFmpeg and ffprobe. These are installed on the current Mac. The launchers automatically select the installed Homebrew Node 24 when the shell uses unsupported Node 23. On other machines select the supported Node version first; install local prerequisites from their official distributions.

From the repository:

```sh
npm run dev:setup
```

Setup starts an owned MySQL instance in ignored `.local/mysql`, verifies its datadir and port, creates only the two local databases, generates Prisma and applies the two reviewed migrations using explicit local connection URLs. Repeating setup preserves existing local rows. It writes an ignored, permission-restricted `.env.local`, leaving `.env` untouched. It creates a limited local app database user with a generated password, never printed. `.local/mysql-owner.json` is private local credential/ownership state; do not share or commit it. Local MySQL administrative access is socket/loopback-only and intended for a single-user development machine, never deployment.

In two terminals:

```sh
# Terminal 1
npm run dev

# Terminal 2
npm run dev:socket
```

Open **http://localhost:3000**. Use that hostname consistently; the supported launcher binds Next to `localhost` to keep Clerk's internal rewrite handling consistent. Socket.IO binds `127.0.0.1:3001` and accepts the exact frontend origin. Its `/health` and `/ready` endpoints are available at http://localhost:3001.

Both launchers use Next's development environment precedence (`process.env`, `.env.development.local`, `.env.local`, `.env.development`, `.env`). Exported variables still win: remove an exported remote `DATABASE_URL` if the guard refuses startup. The guard accepts only `mysql` on `127.0.0.1:33367/goga_development` and rejects socket overrides. No automatic fallback or migration occurs during normal frontend/socket startup. A read-only schema preflight runs first; `dev:setup` is the explicit local migration command.

The existing Clerk **development** keys are used. If they are absent, configure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…` and `CLERK_SECRET_KEY=sk_test_…` securely in `.env.local`; live keys are refused by these launchers. Sign in using existing development accounts. After successful Clerk authentication, a development-only helper mirrors that authenticated account into local MySQL. It checks the verified identity and exact local database, preserves existing profiles, and completes before sockets connect. It does not create Clerk users or bypass authentication, and does not require a public webhook tunnel.

Stop each foreground launcher with Ctrl-C. MySQL remains available across frontend restarts. After stopping both launchers, `npm run dev:db:stop` gracefully stops only the database verified as belonging to this checkout, preserving its files. `npm run dev:setup` starts it again.

## Populate usable local content

Sign in to **http://localhost:3000** using your existing Clerk development account and load the app once. Then run:

```sh
npm run dev:status
npm run dev:fixtures
```

Refresh the homepage and Chat. The fixture command verifies the exact local URL, MySQL socket/datadir ownership and selected database before writing. It adds three clearly labeled synthetic profiles (`demo_maya`, `demo_noah`, `demo_leo`), 14 public feed posts, a post on your own profile, comments/likes, a poll, an event, two stories, mutual demo follows, three direct conversations, a group you own and a pending group invitation. Maya's history has more than 30 messages for pagination; it includes an original generated three-second tone through the real private voice-storage pipeline. The generated watch clip remains `http://localhost:3000/local-test/watch.mp4`.

Fixtures link to existing local `user_…` identities created by verified Clerk development sign-in. **Demo profiles are database fixtures, not Clerk accounts:** they cannot log in, type replies or answer calls. No authentication bypass or automatic pretend participant is installed. Use a second real development login in another profile for bidirectional call testing; load the app once and rerun fixtures to give that identity its own demo conversations. Existing real development accounts can also find/follow/message each other normally.

The command is additive: it never resets, deletes or migrates a database, overwrites a real profile, or uses production. Repeating it preserves IDs, edited fixture posts and renamed groups using ignored `.local/fixtures-v1.json`; message idempotency keys prevent duplicates. It recreates missing fixtures and refreshes expired synthetic stories. Keep the state file with this local database. Do not run concurrent seeders. If interrupted, inspect a stale `.local/fixtures.lock` before removing it and retrying. A deliberate block against a demo person may prevent that conversation's fixture refresh; the guard respects the block.

`dev:status` prints only sanitized local database identifiers, row counts and account counts. Both services use the same guarded environment loader. Next also guards Prisma construction directly; Socket.IO checks schema before starting. Development Server Action argument logging is disabled so message bodies and push keys do not enter terminal logs.

If a browser tab is empty after seeding, refresh it: server-rendered feed data and the contact list are loaded on navigation/mount. Sign-in sessions are browser/profile-specific. A signed-out in-app browser will still show sign-in even when Chrome is authenticated. Extensions that inject markup (observed `data-writer-injected` and `speechify-screenshot-mode`) can cause hydration warnings; use a clean test profile to isolate them. Do not suppress real hydration errors to hide extension interference.

### Actual production content

Production content is not required for this workflow and was not accessed or copied. If an issue later requires a representative production snapshot, first obtain explicit approval for its scope and read-only access. An operator should create a consistent export with a dedicated read-only database account, sanitize it in a restricted environment **before transfer**, replace user identities/text/media with synthetic values, omit subscriptions/tokens/contact details/private messages, and map retained relationships to development Clerk IDs. Transfer only the approved sanitized artifact over authenticated SSH, verify its manifest, and import into a new disposable local database for review. Never point the local app at production or import a raw private dump into this workspace. Review export load, encrypted storage, retention and cleanup separately; no export command has been run.

## Exercise communications

1. Sign in as two different Clerk development users in separate browser profiles. Each must load the app once so its local profile exists. Find/follow the other test account using the existing social UI, then open Chat.
2. Send text in both directions, reload, open history, switch conversations, send a reply, react, edit/delete your own message, and check read/typing/presence behavior across tabs.
3. Create a group, invite the second account, accept from that account, then test owner/admin removal. An invitation alone must not grant history access.
4. In the direct conversation, record a short voice note, preview/cancel one recording, then send another. Verify play/pause/seek and reload persistence. FFmpeg normalizes audio into private storage outside the checkout. The local storage path is in `.env.local`; the default is a per-user OS temporary directory, so local audio may be removed by OS cleanup. Database persistence alone does not preserve audio after deleting that directory.
5. Start audio/video calls; accept on the other account, mute, toggle camera, share a screen/window, stop sharing, hang up and check that device indicators stop. Group LiveKit remains disabled. Localhost testing does not prove TURN traversal or separate-device media quality; follow [the device procedure](media-test-procedure.md) on approved HTTPS staging before release.
6. Create a watch party with the generated, original test-pattern video: **http://localhost:3000/local-test/watch.mp4**. Confirm that you have permission to play it. Join from the other account; test play/pause/seek, host controls, reconnect, and theater mode. This HTTP exception is limited to explicitly enabled isolated development and allowlisted loopback hosts. Production still requires approved HTTPS sources. No movie is relayed or transcoded by the watch-party service.

For separate physical devices, use approved HTTPS staging and its own database. Do not expose this local MySQL or insecure HTTP development server to a network to work around browser media permissions. The existing [coturn example](../ops/coturn.conf.example) and [operations guide](operations.md) require operator approval before VPS changes.

## Verify

```sh
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
```

`test:integration` verifies the owned local MySQL socket before setting its own disposable test URL. It runs the original MySQL, real Socket.IO/HTTP runtime and synthetic-fixture suites serially. The runtime suite uses synthetic users and ephemeral RSA-signed JWTs verified by the actual Clerk SDK, actual Prisma persistence, real multipart voice handlers and FFmpeg, and real loopback Socket.IO clients. It checks conversation listing/history, delivery/retries/tabs, groups, voice authorization/range reads, call signaling/ICE credentials, watch versioning/reconnect/host changes and block revocation. Its test-only authentication adapter is never imported into the application. The fixture suite checks repeat-run preservation, populated history and access rules. These automated suites do not prove physical microphone/camera capture or TURN; separate interactive evidence is recorded in [validation](validation.md).

## Diagnosed failures

- The original `.env` selected the supplied VPS MySQL; there was no local override. The existing frontend log explicitly reported missing `Conversation.kind`. A matching isolated baseline reproduced conversation failure and Prisma `P2021` in the sweeper's `CallSession` query. The new code needs the additive communications migration. No production migration or new production inspection was attempted.
- Previously Socket.IO accepted connections before checking schema readiness; authentication only needed legacy user fields. Conversation queries and every five-second room sweep then failed. Startup now rejects an incomplete schema before listening/timers; sanitized diagnostics expose Prisma codes, known model/column names and project stack locations without secrets, SQL or message contents.
- Binding Next to `127.0.0.1` caused Clerk's normalized `localhost` rewrite to be treated as an external self-proxy. Binding the frontend to `localhost` fixes that request loop while retaining Clerk middleware.
- The chat component emitted `leaveConversation`, while the server listened for `leaveConversationRoom`. Cleanup now clears typing and releases the actual socket room without changing group membership.
- A fresh isolated database has no webhook-created users. The verified local bootstrap and readiness gate address that missing account and the sign-in refresh race.
- The existing navigation bar redirected every anonymous visit, including `/sign-in`, to `/sign-up`. It now redirects only on an actual authenticated-to-signed-out transition. The real Clerk sign-in form was verified to remain on `/sign-in`.

The earlier missing `.next/dev` manifests were not reproduced after a controlled restart. The launchers refuse duplicate port-3000 servers (IPv4/IPv6). If a stopped development cache is damaged, run `npm run dev:clean`; it removes only `.next/dev` and refuses while the frontend port is in use. Next's production build uses its separate output and does not require deleting development state. Never run multiple `next dev` processes against this checkout.

See [runtime diagnostics](RUNTIME-DIAGNOSTICS.md) for error references and [validation](validation.md) for remaining release gates. No production deployment is part of this workflow.
