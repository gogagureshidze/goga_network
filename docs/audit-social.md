# Social/authentication audit — 13 November 2026

Scope: all existing non-chat server action modules, Clerk webhook and middleware,
Prisma social models, feed/profile/media/story render paths, media widgets, push
subscription flow, deployment files, package scripts and available tests. No
production database, credential values, deployment or external service was read
or modified. Socket/chat findings are covered separately.

## Architecture observed

- App Router server components render MySQL data through the shared Prisma client.
  Clerk `currentUser`/`auth` identifies users inside most server actions. Middleware
  originally protected only unused `/dashboard` and `/forum` matchers, so server
  action authorization is the actual security boundary.
- User identity synchronizes from signed Svix/Clerk events; local profile fields
  remain in MySQL. Relationships are mutual follows, pending requests and directed
  blocks. Profile privacy depends on the viewer following the owner.
- Posts have separate media, tags, comments/replies, likes, events, polls/options
  and shares. Stories move into snapshot archive tables and can be published as
  highlights. Archive and live story IDs use separate integer sequences.
- Cloudinary browser widgets use unsigned `social` upload preset; public delivery
  URLs are persisted in existing media fields. Cloudinary is also used by caption
  generation. Google Gemini supplies captions. Web Push/VAPID handles likes and
  notification subscriptions; Google Maps is present for event maps.
- Existing cached feed relationship decisions lived for 30–60 minutes; invalidation
  tags were inconsistent. Root layout fetched the entire user directory on every
  route. No existing automated tests or test script were present at audit start.

## Fixes in this slice

- Poll creation/voting now authenticates the supplied account identity. Votes verify
  the option belongs to the poll, reject expiry/duplicates inside a serializable
  transaction, and enforce post privacy/block access. Results require access too.
- Story-comment deletion permits only its author or story owner; story views cannot
  impersonate another user. Story comment/like/view reads and writes check visibility;
  comments enforce the owner's comments setting and database-sized text limits.
- Highlight reordering verifies every entry belongs to the owned highlight. Adding
  archives checks archive ownership. Published highlights check privacy/block access;
  unpublished archives remain owner-only. Nonowners no longer receive story viewer
  lists in the returned nested payload. Hidden story likes are also removed from nested
  highlight responses while preserving the caller's own reaction state.
- `social-access.ts` centralizes current-state owner/public/follower and bidirectional
  block checks. Post comment/reply/like/activity actions use it. Replies cannot attach
  to a parent from another post. Single-post and profile-feed actions enforce access.
- Feed visibility now uses relational filters in the paginated SQL query, removing
  a full scan of all private user IDs and stale relationship caches from that path.
- Blocking atomically removes both follow directions and pending requests. New
  follows and accepting a request reject blocks in either direction.
- Caption generation requires authentication, bounds item count, applies a local
  per-account cooldown, permits only HTTPS Cloudinary upload URLs for the configured
  cloud (existing cloud fallback retained), rejects redirects, checks MIME, limits
  streamed images to 5 MB and times out media/model requests. Raw provider error
  messages no longer become client responses.
- Duplicate Clerk creation events use upsert and preserve local profile fields;
  repeated deletions use deleteMany. Signature verification remains required.
- Push subscriptions validate provider URLs and encryption-key sizes before storage
  and again before delivery. Existing endpoints cannot be transferred between
  accounts; serializable registration caps accounts at 20 subscribed devices.
  Delivery uses a 10-second timeout, and operational logs omit identities, payloads,
  endpoints, keys and provider response bodies. Repeated positive like intents do
  not duplicate notifications; manual push tests have a process-local cooldown.
- Public archive actions require authentication and process at most 25 stories
  owned by the current account. A server-only maintenance helper supports bounded
  all-account batches. Snapshot creation, highlight relinking and source deletion
  share a locked serializable transaction; duplicate archive requests reuse the
  existing snapshot. Reposting also moves highlight references atomically.
- Initial Stories rendering uses the correct follower relation and current blocks
  in both directions before returning stories to the client.

## Remaining release risks and decisions

1. **Media delivery/privacy:** unsigned social uploads accept client-provided URLs
   and do not verify upload ownership, bytes, moderation or retention server-side.
   Existing public Cloudinary URLs cannot be made private by hiding a page. Migrate
   new sensitive uploads to authenticated delivery with explicit asset ownership;
   inventory old assets before any retention/deletion change. Root owns `/media`
   page authorization remediation; this action slice does not change CDN policy.
2. **Push operations:** new subscriptions and legacy rows are validated before any
   outbound request. Additional providers require exact `PUSH_ALLOWED_HOSTS` entries
   after operator review; defaults cover Chrome/Firefox/Safari and Microsoft WNS.
   Switching accounts in the same browser requires unsubscribing and obtaining a
   new subscription, rather than silently transferring the prior account's endpoint.
   Best-effort delivery and process-local cooldowns are not a durable notification
   job queue or distributed quota.
3. **Archive operations:** public global mutation is closed. Deploy a trusted
   server maintenance worker using `archiveExpiredStoryBatch` for dormant accounts;
   it processes at most 100 source stories per invocation. Do not expose that helper
   as an unauthenticated endpoint. Interactions within each snapshot are preserved,
   so large single-story histories still need staging load measurements. Transaction
   lock/retry behavior needs verification against staging MySQL before release.
4. **Account deletion:** conversation/message foreign keys do not cascade user
   deletion. Clerk delete retries may fail while history exists. Retention and
   anonymization policy must be reviewed before changing those relations.
5. **Privacy completeness:** initial Stories, profile privacy/activity and profile
   relationships now read current authorization state; profile DB failures fail closed.
   Feed payloads redact hidden activity timestamps, and root user search is authenticated
   and bounded. Shared-post reads recheck current recipient access. Follow-list and
   standalone activity lookup remain legacy contracts needing staging privacy review;
   activity fallback can amplify Clerk API requests. Public-CDN URLs remain the primary
   known confidentiality limitation; no comprehensive privacy claim is made.
6. **Data consistency:** follow/block races across concurrent requests need a shared
   transaction/locking policy; app-level toggles and in-process like locks are not
   distributed locks. Poll serializable behavior must be exercised against staging
   MySQL. Highlight creation's container/children can still leave partial state. Archive
   snapshot/repost copy-delete is now atomic; existing archive/live ID collision
   handling elsewhere is ambiguous.
7. **Performance:** media cards fetch all matching posts before slicing eight media;
   comments/likes/viewer lists and directory data are unbounded. Paginate those
   contracts with UI support. Measure real queries with EXPLAIN before adding indexes.
8. **Deployment:** original `netify.toml` is misspelled, contains raw Nginx config and
   is invalid TOML. Its CSP would block Clerk/widgets and Permissions-Policy disables
   microphone/camera. The Nginx `/health` example checks the proxy, not the process.
   New app headers allow same-origin media permissions; proxy policy must be reconciled
   by the operator. No deployed server configuration was changed.
9. **Build baseline:** package manifest had React 19 with React 18 type packages,
   Next 16 with ESLint 15 config, and obsolete `next lint`. Local installed Next
   declarations were incomplete; global typecheck initially failed in many existing
   app/components. No false production-readiness claim follows from unit tests.
10. **Rate limits/CSRF:** the caption cooldown is process-local, not a cross-instance
    quota. Other social actions need measured service/edge limits. Preserve Next
    Server Action origin protections when configuring proxy hosts; do not widen
    allowed origins without review. No broad custom CSP was enabled without checking
    the real Clerk, Cloudinary and media permission requirements.

## Verification

`node --test tests/social-security.test.cjs` passes 15 behavioral regression tests
covering spoofed actors, unauthorized deletes, cross-resource IDs, private/block
access, archive privacy, mismatched replies, SSRF URL rejection, response size bounds
and authenticated caption generation. They transpile and execute actual action code
with mocked database/auth/network boundaries. They are **not** live MySQL, Clerk,
Cloudinary, browser or production tests. Staging must exercise two separate users,
blocked pairs, private accounts, concurrent polls, webhook retries, CDN access and
regression flows before human production approval.

Additional verification: `node --test tests/push-security.test.cjs tests/story-archive.test.cjs`
passes 12 focused tests covering SSRF destinations, key validation, cross-account
endpoint ownership, authenticated owner-scoped bounded batches, transaction ordering,
duplicate archive retries, bounded serialization-conflict retries, replayed like
notification suppression, legacy outbound endpoint checks, and preserving source
rows when snapshot creation fails.
These use isolated service boundaries and do not establish live database concurrency
or third-party push delivery. No existing records were modified during this work.

Final profile validation adds six behavioral tests for fresh privacy/follow/activity state, both block directions, fail-closed query errors, anonymous denial and owner lookup. The complete validation record is in `validation.md`.
