# Packages

Every package is `@chia/<name>`, references siblings with `workspace:*` and exports source. Treat each package's `exports` map as its public module list.

## API architecture

The API spans three packages:

| Package       | Responsibility                                                           |
| ------------- | ------------------------------------------------------------------------ |
| `api`         | oRPC contracts, handlers and guards; domain orchestration and host ports |
| `service-kit` | Request context, policies, errors, middleware and transport adapters     |
| `db`          | Drizzle schemas and repositories                                         |

### Contracts

Wire contracts live in `api/orpc/contracts/*.contract.ts`; handlers live in `api/orpc/routes/*.route.ts`. `router.contract.ts` and `router.ts` compose them and must remain key-for-key identical. Consumers import contract types only.

### Authorization

Authorization belongs in `service-kit/src/policies`. Bind policies through `runPolicy` for oRPC or `toHonoMiddleware` for Hono. Guards contain transport binding, not duplicated authorization logic. API keys carry scopes from `@chia/auth/apikey`; a guard that admits `CallerTier.ApiKey` states the scopes it needs, and a key sent without them is refused even where a browser would pass. `operator:root` on a key the configured admin owns lifts it to `CallerTier.Root`; agent guards then take the user from the key.

### Context injection

`packages/api` reads no environment variables and holds no host state. `BaseOSContext` supplies:

- `config`: rate limits and AI key material.
- `workflow`: the `@chia/workflow-control` client.
- `hooks`: optional feed and memory lifecycle hooks.
- `agentFactory`: optional per-kind bindings, dynamic definition loaders and credential handling.

`apps/service/src/factories/orpc.factory.ts` is the only place that constructs this context. Agent orchestration stays in `api/orpc/services/agent`; host apps supply bindings, not duplicate services or registries. Missing optional factories return `SERVICE_UNAVAILABLE`.

### Data and errors

- oRPC handlers use `@chia/db/repos/*`, not raw Drizzle.
- Write logic shared with workflow steps belongs in `api/<domain>/write` and receives lifecycle hooks explicitly.
- `feed_draft` is the only write path for post content shared by the editor, MCP and the writing agent; `api/feeds/draft` owns open, patch, apply, discard and restore. `feed` changes only through apply or the feed-level `feeds.update`, and only those start indexing. A writing session is not bound to a draft: `agent.writing_session_draft` records the drafts it worked on, and a prompt hands one over as an attachment that the kind's `attach` admits before the turn is queued.
- Domain and policy failures use `AppError`; its codes mirror oRPC common codes.

## Core package boundaries

- Dates: persist and compare instants as `Date` (Drizzle `mode: "date"`) and ISO strings on the wire. Calendar, timezone, locale and display use `@chia/utils/day`. Do not import `dayjs` directly.
- `service-kit`: `createServiceFactory()` builds per-request `ServiceContext`; `bootstrap()` applies cross-cutting Hono middleware.
- `db`: every timestamp column is `timestamptz` (`withTimezone: true`); a plain `timestamp` would be read as UTC by Drizzle but written in the process's zone by a raw `sql` parameter. Timestamp columns use `mode: "date"`. `connectDatabase(env, { withCache })` is memoized by URL and cache setting. Request paths may use explicit Redis-backed Drizzle caching; workflow steps use `withCache: false`. All text and JSON parameters pass through `storableCodecs` before reaching Postgres.
- `auth`: Better Auth configuration and server/browser clients. Keep email providers and templates lazily imported.
- `kv`: shared Keyv adapters, the Drizzle cache and rate-limiter integration.
- `ai`: embeddings, chunking, content tools, provider model creation and API-key crypto. Keep provider SDKs lazily imported. `@chia/ai/provider` is the only definition of the vendors, the keys a caller may bring (each vendor or the gateway) and their cookie names; `@chia/ai/house-models` is the only place a house-billed model id is written, keyed by role. `@chia/ai/env` owns `EMBEDDING_PROVIDER`, `EMBEDDING_API_KEY` and `OLLAMA_BASE_URL`.
- `meta`: site metadata authored in Pkl, generated as `meta.json`.

## Agent packages

Read [`docs/agent-architecture.md`](../docs/agent-architecture.md) before changing this subsystem.

| Package          | Boundary                                                                       |
| ---------------- | ------------------------------------------------------------------------------ |
| `agent-runtime`  | Kind-independent session, turn, tool, compaction, wire-event and model runtime |
| `agent-content`  | Shared read-only content tools, `ContentReadPort` and `ProfileReadPort`        |
| `agent-writing`  | Writing prompts, tools, policy, state and content/web ports                    |
| `agent-public`   | Public reader prompt, policy and model policy                                  |
| `agent-elements` | Client session store, queries, providers and UI components                     |

`agent-runtime` exports `./pi/*`, `./session/*` and `./models` for server use only. Browser and SSR bundles may import `./wire/schema` and `./wire/fold`; `./wire/replay` remains server-only because it loads Pi.

`agent-elements` owns live client state in one zustand store per session and server state in TanStack Query. Hosts provide the oRPC client, `QueryClient`, localized labels and kind-specific renderers. Host Tailwind sources must include this package and Streamdown's distributed JavaScript. Every locale must carry the same keys; agent label tests enforce this.

## Testing

`@chia/test` must not depend on other `@chia/*` packages.

- `@chia/test/config` — `nodeConfig` / `domConfig`. App configs add `setupFiles`. DOM Testing Library tests must `cleanup()` in setup.
- `@chia/test/env` — `stubTestEnv()`.
- `@chia/test/session`, `@chia/test/context` — `sessionOf`, `contextOf`, `serviceContextOf`.
- `@chia/test/orpc` — `session` fixture; extend `context` in the consumer. Import `vi` from `vitest`.
- `@chia/test/mocks/*` — `vi.mock` wiring stays in the consumer.
- `@chia/test/fixtures/content-read-port`, `@chia/test/fixtures/profile-read-port` — read-port fakes.

Keep app-specific helpers next to the app. Import `{ describe, expect, it, vi }` from `vitest`. Titles are behavior sentences, not `should ...`.
