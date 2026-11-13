# Push and story lifecycle operations

Public action signatures and return shapes are retained. The formerly unrestricted
archive actions now authenticate and scope work to the caller's own stories. The
home page invokes owner-scoped archiving only after sign-in succeeds.

## Push provider configuration

Defaults permit HTTPS `fcm.googleapis.com`, `updates.push.services.mozilla.com`,
`web.push.apple.com` and a single subdomain under `notify.windows.com`. Custom ports,
embedded credentials, fragments, IP literals, lookalike domains and malformed push
keys are rejected. `PUSH_ALLOWED_HOSTS` can add comma-separated exact provider hostnames
only after review. Never add user-supplied hosts or an untrusted DNS zone.

Subscriptions remain bound to their original account. A second account on the same
browser must create a new browser push subscription; it cannot claim the existing
endpoint by resubmitting it. Each account can hold up to 20 devices. Invalid legacy
rows are skipped at delivery without changing stored data. Delivery timeouts are
10 seconds, and provider error bodies, endpoints, encryption keys and payloads do
not enter operational logs. Manual notification tests are limited to once per
30 seconds per account in each app process. A future multi-instance deployment
needs a shared quota and a durable notification queue if delivery guarantees matter.

Provider references checked during implementation:
[Mozilla Autopush](https://mozilla-services.github.io/autopush-rs/http.html),
[Firebase endpoints](https://firebase.google.com/docs/reference/fcm/rest),
[WebKit Web Push](https://webkit.org/blog/13878/),
[Microsoft WNS allowlist](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/push-notifications/firewall-allowlist-config).

## Archive scheduling

`src/lib/story-archive.ts` is server-only. Trusted application maintenance code can
call `archiveExpiredStoryBatch({ limit: 25 })` to process all accounts. The helper
caps each invocation at 100 stories; public server actions always include the
current account's `ownerId` and a limit of 25. A worker should run bounded iterations
and record counts and failures without user/media data. There is no new public cron
endpoint and no scheduled task was installed by this change.

Per-story transactions lock the live row, create or reuse the archive snapshot,
move existing highlight references to the archive, and only then delete the live
story. Failed copies roll back; retries reuse existing snapshots. Deadlock/serialization
conflicts retry at most three times. Reposts create the new story, move highlight
references and delete the old archive in one transaction. Existing likes, views and
comments are preserved in snapshot tables rather than truncated.

Staging must exercise two competing archive requests, a failed archive write,
highlight preservation, manual archive racing expiry, and the provider subscription
flow in Chrome, Firefox, Safari and Edge. Current unit tests execute real action and
helper code with isolated database/auth/network boundaries; they do not replace
those staging checks. No production data or external infrastructure was changed.
