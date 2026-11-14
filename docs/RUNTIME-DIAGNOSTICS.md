# Communications runtime diagnostics

Socket startup now performs a read-only schema preflight **before** constructing room sweep timers or opening its listener. It checks the generated Prisma delegates and the required communications tables/columns in `information_schema.COLUMNS`, including nullable legacy participant fields needed by groups. It does not read message contents, change a schema, or apply migrations. A missing schema exits startup instead of accepting connections that will repeatedly fail. A 10-second deadline bounds the metadata check.

Non-production socket startup also calls the local database guard before constructing Prisma. The socket listener defaults to `127.0.0.1`; `SOCKET_HOST` accepts only a literal IPv4/IPv6 address, so a hostname cannot trigger unexpected DNS resolution. An explicit wildcard IP remains available for an approved container/proxy topology.

The preflight is exported as `preflightDatabase(prisma)` from `server/db-preflight.js` for launchers that need the same check before starting Next.js. It validates required schema presence and selected nullability; it does not replace migration review, foreign-key/index checks, or integration tests.

## Safe diagnostic records

Internal event errors, startup failures, database-dependent authentication failures, readiness errors, room sweep failures, and disconnect cleanup failures receive a random `diagnosticId` and a stable `diagnosticCode`. Server records include only allowlisted error class/code, known Prisma model/table/column names, and known project stack-frame filenames with line numbers. Exception messages, SQL, query values, environment values, database names/URLs, user IDs, tokens, and incoming event payloads are omitted.

Socket clients receive a generic availability message with the diagnostic code and reference ID. They receive no stack, Prisma metadata, database endpoint, or exception message. Account-lookup database failures are reported as service unavailability rather than asking a successfully authenticated user to sign in again.

| Diagnostic code | Operator action |
| --- | --- |
| `DB_SCHEMA_NOT_READY` | Confirm the configured environment. Compare the reported known table/column checks with reviewed migrations. Rehearse and approve staging migrations before any production change. |
| `DB_CLIENT_OUTDATED` | Regenerate the Prisma client from the reviewed schema, then rebuild/restart the local or staging service. |
| `DB_UNAVAILABLE` | Check the approved database process, connection pool, network reachability, and timeout configuration. |
| `DB_ACCESS_DENIED` | Check server-side credentials/permissions using the approved environment; do not paste credentials into logs or chat. |
| `SERVER_CONFIGURATION_INVALID` | Check required server-only Clerk configuration, exact CORS origins, literal bind address, and numeric port. |
| `LISTENER_ADDRESS_IN_USE` | Identify the already-running local service or select the reviewed port; do not kill unrelated processes. |
| `PROCESS_PERMISSION_DENIED` | Check local bind/filesystem permissions and the execution sandbox. |
| `SERVER_OPERATION_FAILED` | Correlate the reference ID with the sanitized server error class/code and project frames. |

A missing `Conversation.kind` fails conversation listing, and missing `CallSession` or `WatchParty` tables fail the room sweeper. Previously these paths yielded only a generic request/sweep failure. The preflight and structured errors now make that schema mismatch explicit without exposing the database connection string.

Tests use fake database adapters for preflight and real ephemeral loopback Socket.IO connections for diagnostic acknowledgements. They verify that preflight failure creates no listener/room timers and that server/client output excludes injected credentials, SQL values, database names, and tokens.
