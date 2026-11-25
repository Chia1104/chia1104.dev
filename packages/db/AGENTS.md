# `@chia/db`

Drizzle schemas, database connection management and repository implementations.

## Boundaries

- Applications and domain services access tables through `repos/*`; raw Drizzle queries stay inside this package.
- All persisted instants use `timestamptz` with `withTimezone: true` and Drizzle `mode: "date"`.
- `connectDatabase(env)` is memoized by URL. Every query goes to the primary, because ParadeDB Community rejects search-index queries on a standby. Queries are not cached; a reader that needs caching owns it above the repository.
- Pass text and JSON parameters through `storableCodecs` before writing them to Postgres.
- Repositories enforce ownership on the row being read or locked and return `not_found` for another user's record.
- A migration is its `migration.sql`. drizzle-kit rebuilds its diff baseline by replaying every `snapshot.json` from the first, so none may be deleted.
- `feed_draft_revision` rows are immutable except `pinned` and the name given with it. `hashFeedDraftSnapshot` has a SQL twin in the migrations; a change to its layout rehashes both draft tables in the same migration.
