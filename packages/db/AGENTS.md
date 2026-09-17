# `@chia/db`

Drizzle schemas, database connection management and repository implementations.

## Boundaries

- Applications and domain services access tables through `repos/*`; raw Drizzle queries stay inside this package.
- All persisted instants use `timestamptz` with `withTimezone: true` and Drizzle `mode: "date"`.
- `connectDatabase(env, { withCache })` is memoized by URL and cache setting. Workflow steps use `withCache: false`; request paths opt into Redis-backed caching explicitly.
- Pass text and JSON parameters through `storableCodecs` before writing them to Postgres.
- Repositories enforce ownership on the row being read or locked and return `not_found` for another user's record.
- `feed_draft_revision` rows are immutable except `pinned` and the name given with it. `hashFeedDraftSnapshot` has a SQL twin in the migrations; a change to its layout rehashes both draft tables in the same migration.
- `@chia/db/schema` is the only allowed aggregate package export.
