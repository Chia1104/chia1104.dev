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

Authorization belongs in `service-kit/src/policies`. Bind policies through `runPolicy` for oRPC or `toHonoMiddleware` for Hono. Guards contain transport binding, not duplicated authorization logic.

### Context injection

`packages/api` reads no environment variables and holds no host state. `BaseOSContext` supplies:

- `config`: rate limits, project ID and AI key material.
- `workflow`: the `@chia/workflow-control` client.
- `hooks`: optional feed and memory lifecycle hooks.
- `agentFactory`: optional per-kind bindings, dynamic definition loaders and credential handling.

`apps/service/src/factories/orpc.factory.ts` is the only place that constructs this context. Agent orchestration stays in `api/orpc/services/agent`; host apps supply bindings, not duplicate services or registries. Missing optional factories return `SERVICE_UNAVAILABLE`.

### Data and errors

- oRPC handlers use `@chia/db/repos/*`, not raw Drizzle.
- Write logic shared with workflow steps belongs in `api/<domain>/write` and receives lifecycle hooks explicitly.
- Domain and policy failures use `AppError`; its codes mirror oRPC common codes.

## Core package boundaries

- `service-kit`: `createServiceFactory()` builds per-request `ServiceContext`; `bootstrap()` applies cross-cutting Hono middleware.
- `db`: `connectDatabase(env, { withCache })` is memoized by URL and cache setting. Request paths may use explicit Redis-backed Drizzle caching; workflow steps use `withCache: false`. All text and JSON parameters pass through `storableCodecs` before reaching Postgres.
- `auth`: Better Auth configuration and server/browser clients. Keep email providers and templates lazily imported.
- `kv`: shared Keyv adapters, the Drizzle cache and rate-limiter integration.
- `ai`: embeddings, chunking, content tools, provider model creation and API-key crypto. Keep provider SDKs lazily imported.

## Agent packages

Read [`docs/agent-architecture.md`](../docs/agent-architecture.md) before changing this subsystem.

| Package          | Boundary                                                                       |
| ---------------- | ------------------------------------------------------------------------------ |
| `agent-runtime`  | Kind-independent session, turn, tool, compaction, wire-event and model runtime |
| `agent-content`  | Shared read-only content tools and `ContentReadPort`                           |
| `agent-writing`  | Writing prompts, tools, policy, state and content/web ports                    |
| `agent-public`   | Public reader prompt, policy and model allowlist                               |
| `agent-elements` | Client session store, queries, providers and UI components                     |

`agent-runtime` exports `./pi/*`, `./session/*` and `./models` for server use only. Browser and SSR bundles may import `./wire/schema` and `./wire/fold`; `./wire/replay` remains server-only because it loads Pi.

`agent-elements` owns live client state in one zustand store per session and server state in TanStack Query. Hosts provide the oRPC client, `QueryClient`, localized labels and kind-specific renderers. Host Tailwind sources must include this package and Streamdown's distributed JavaScript.

Every locale must carry the same keys; agent label tests enforce this. `meta` is authored in Pkl and generated as `meta.json`.

## Testing

Shared Vitest helpers live in `@chia/test`. Import a named module, never a root barrel.

- `@chia/test/config` — `nodeConfig` / `domConfig` presets (`globals: false`, `clearMocks: true`). App configs only add `setupFiles`, aliases and plugins. DOM apps that use Testing Library must `cleanup()` in setup; `globals: false` disables its auto-cleanup.
- `@chia/test/env` — `stubTestEnv()` for `SKIP_ENV_VALIDATION` and `NODE_ENV`.
- `@chia/test/session` and `@chia/test/context` — `sessionOf`, `contextOf`, `serviceContextOf`.
- `@chia/test/orpc` — those factories plus an extended `it` with `session` / `context` fixtures. Import `vi` from `vitest`; `vi.hoisted` does not work through this re-export.
- `@chia/test/mocks/*` — feed repo, workflow World, and in-memory KV `vi.fn`s. `vi.mock` wiring stays in the consuming project's `setup.ts` or test file.
- `@chia/test/fixtures/content-read-port` — `ContentReadPort` fake. Writing's write-side port stays in `packages/agent-writing/__tests__/fixtures.ts`.

Keep app-specific helpers next to the app: service guards and RPC `app.request` wrappers, www MSW and `renderWithProviders`. Setup files mock only what every test in that project needs. Import `{ describe, expect, it, vi }` from `vitest`. Titles are behavior sentences, not `should ...`.
