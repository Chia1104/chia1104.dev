# Packages

Read the root [`AGENTS.md`](../AGENTS.md) first for the engineering rules, commands and conventions. This file describes the shared packages and the architecture they implement. The deployables are described in [`apps/AGENTS.md`](../apps/AGENTS.md).

Every package is `@chia/<name>`, depends on siblings with `workspace:*`, and **exports source, not build output** — `exports` maps point at `./src/...ts` and the consumer transpiles. Adding an entry point means adding it to that package's `exports` map. Env is validated per package with `@t3-oss/env-core` in an `env.ts` the apps compose via `extends`.

## API architecture

Three packages carry it: `api` (contracts, handlers, guards, ports), `service-kit` (context, policies, errors, transport adapters) and `db` (schemas, repositories).

**Contract-first oRPC.** The wire contract lives in `packages/api/orpc/contracts/*.contract.ts` and is composed in `router.contract.ts`. Handlers live in `packages/api/orpc/routes/*.route.ts` and are composed in `router.ts` via `contractOS` (`implement(routerContract)`). The two trees must stay key-for-key identical. Consumers import the contract type only.

**Guards and policies.** Authorization logic lives once as a _policy_ in `packages/service-kit/src/policies` (`sessionPolicy`, `apiKeyPolicy`, `adminPolicy`, `callerPolicy`, `rateLimitPolicy`, `captchaPolicy`, `aiKeyPolicy`) and is bound to each transport by a thin adapter: `runPolicy` for oRPC middleware (`packages/api/orpc/guards/`), `toHonoMiddleware` for Hono middleware (`apps/service/src/guards/`). Write new authorization as a policy, not as a guard.

**Context injection.** `packages/api` parses no env and holds no module-level state. Everything the guards and routes need from the host travels on the oRPC context, `BaseOSContext` in `packages/api/orpc/utils.ts`:

- `config` — required: rate-limit budget, project id, AI key material.
- `hooks.onFeedChanged` / `hooks.onFeedRemoved` — optional feed lifecycle hooks (`FeedHooks`), fired by the content write paths.
- `indexing` — optional `IndexingService` port; starts and reconciles resource index runs.
- `agentKinds` — optional map of `AgentKindService` keyed by `agent_session.kind`.

The port interfaces live in `packages/api/orpc/services/` (`agent.service.ts`, `indexing.service.ts`) next to `requireIndexing(context)` / `requireAgentKind(context, kind)`, which answer `SERVICE_UNAVAILABLE` when the context lacks the port. `apps/service` is the only process that runs the router and supplies all of these in `createORPCContext`. Anything that needs a long-lived process, a DB handle or gateway credentials belongs in the app, not here.

**Data access.** oRPC handlers never write raw Drizzle; they call repositories exported as `@chia/db/repos/*`. Write logic shared with workflow steps lives in `packages/api/<domain>/write` (today `feeds/write.ts`) and takes its `FeedHooks` as an explicit argument, so a durable turn can call it with no request to authorize against.

**Errors.** Throw `AppError` from `@chia/service-kit/errors` in domain code; convert at the edge with `toORPCError` / `isAppError`. The `AppError` codes mirror oRPC's common codes so a policy failure maps onto `errors[code]()` without translation.

## Package guide

### `api`

`orpc/` — `contracts/`, `routes/`, `guards/`, `services/` (the ports), `router.contract.ts`, `router.ts`, `utils.ts` (`BaseOSContext`, `contractOS`, `baseOS`). Domain modules beside it: `feeds/` (search, access, write), `resources/` (the RAG resource registry and adapters — see `docs/rag-architecture.md`), and external clients each with their own env: `github`, `spotify`, `s3`, `email` (Resend), `betterstack`, `captcha`. `services/env.ts` holds the service-endpoint env the frontends compose.

### `service-kit`

What every service app boots with. `bootstrap.ts` — `createServiceFactory()` (populates `ServiceContext` on each request: headers, client IP, `db`, `kv`, `auth`) and `bootstrap(app)` (logger, Sentry, error handler, body-size cap, CORS, maintenance). `context.ts` — `ServiceContext`, the per-request shape shared by Hono (`c.var`) and oRPC. `policies/`, `adapters/{hono,orpc}.ts`, `errors.ts` (`AppError`, `APP_ERROR_STATUS`), `middlewares/` (`body-limit`, `maintenance`).

### `db`

Drizzle 1.0 on Postgres. `src/schemas/` — tables and relations; `src/libs/` — repositories, exported as `./repos/<domain>` (`feeds`, `resources/*`, `users`, `organization`, `apikey`, `spotify`, `agent`). `src/client.ts` — `connectDatabase(env, { withCache })`, memoized per URL **and** cache setting; the request path uses the `DrizzleCache` (Redis, explicit `$withCache` only), workflow steps ask for `withCache: false`. `src/types.ts` — pure enums (`Locale`, `FeedType`, `Role`, …) safe to import anywhere. Migrations in `.drizzle/`.

### `auth`

Better Auth. `base-auth.ts` — the options (magic link, passkey, API key, admin, organization plugins; `resend` and the email template are imported lazily). `index.ts` — `createAuth(db, kv)`, memoized to one instance per process. `client.ts` / `client.rsc.ts` — the browser and RSC clients; `utils.ts` — cookie helpers and the `X-CH-API-KEY` header name.

### `kv`

Keyv over Redis (also Valkey, Postgres, Upstash adapters). `kv` is the process singleton the request context carries; `drizzle/cache.ts` is the `DrizzleCache` `db` plugs in; `upstash/with-rate-limiter` wraps Upstash's limiter.

### `ai`

Embeddings (`embeddings/`: provider resolution, OpenAI + Ollama, chunking, markdown, `EMBEDDING_INDEX_VERSION`), the Vercel AI SDK content tools (`tools/content`), `utils/model` (`createModel` over the provider SDKs — imported lazily by its callers), and the API-key crypto used by the AI cookie flow (`utils`). Constants name the provider-key cookies.

### `agent-runtime`, `agent-content` and `agent-writing`

`agent-runtime` — the kind-agnostic agent runtime on top of Pi: session model and Postgres storage (`session/`), the turn loop, tool gate, compaction and event mapping (`pi/`), wire events and replay (`wire/`), model construction with BYOK credentials (`models.ts`), tool-authoring helpers (`tools.ts`, exported as `./tools`), and the TanStack AI transport. `agent-content` — the read-only content tools every kind that reads the blog shares (`search_posts`, `get_post`, `list_posts`, `list_tags`), the `ContentReadPort` they need and their names/labels/summaries; visibility (drafts or published only) is fixed by whichever port the host builds. `agent-writing` — the writing agent: `fetch_url` and the draft/commit tools on top of the content tools, prompts, skills, policy (tool tiers), draft store, model allowlist and its `ContentPort` (the read port plus fetch and writes). A second agent kind is a sibling package of `agent-writing` that composes `agent-content`. Read `docs/agent-architecture.md` first.

### `contents`

MDX rendering with Fumadocs: `content.tsx` / `content.rsc.tsx`, `mdx-components.tsx`, the content context and services.

### `ui`, `editor`, `themes`, `tailwind`, `shaders`

`ui` — shared React components (`./*`), feature blocks (`./features/*`: email templates, error/not-found pages), HOCs and utils. `editor` — the editor components. `themes` — CSS theme files. `tailwind` — the Tailwind v4 preset and layer CSS. `shaders` — Three.js/WebGL effects.

### `i18n`, `meta`, `utils`

`i18n` — `next-intl` message catalogs (`www/en-US.json`, `www/zh-TW.json`). `meta` — site metadata authored in Pkl (`meta.pkl` → `meta.json`, `pkl` ≥ 0.25.2 to regenerate). `utils` — `config` (service endpoints, `withServiceEndpoint`, base URLs), `request` (ky wrapper), `server` (`errorGenerator`, `getClientIP`), `schema`, `day`, `format`, `is`, `error-helper`.
