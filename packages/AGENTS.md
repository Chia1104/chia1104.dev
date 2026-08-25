# Packages

Every package is `@chia/<name>` and depends on siblings with `workspace:*`. Its `exports` map is the authoritative module list — read it rather than expecting this file to enumerate modules.

## API architecture

Three packages carry it: `api` (contracts, handlers, guards, ports), `service-kit` (context, policies, errors, transport adapters) and `db` (schemas, repositories).

**Contract-first oRPC.** The wire contract lives in `packages/api/orpc/contracts/*.contract.ts` and is composed in `router.contract.ts`. Handlers live in `packages/api/orpc/routes/*.route.ts` and are composed in `router.ts` via `contractOS` (`implement(routerContract)`). The two trees must stay key-for-key identical. Consumers import the contract type only.

**Guards and policies.** Authorization logic lives once as a _policy_ in `packages/service-kit/src/policies` (`sessionPolicy`, `apiKeyPolicy`, `adminPolicy`, `callerPolicy`, `rateLimitPolicy`, `captchaPolicy`, `aiKeyPolicy`) and is bound to each transport by a thin adapter: `runPolicy` for oRPC middleware (`packages/api/orpc/guards/`), `toHonoMiddleware` for Hono middleware (`apps/service/src/guards/`). Write new authorization as a policy, and let the guard stay a binding.

**Context injection.** `packages/api` parses no env and holds no module-level state. Everything the guards and routes need from the host travels on the oRPC context, `BaseOSContext` in `packages/api/orpc/utils.ts`:

- `config` — required: rate-limit budget, project id, AI key material.
- `hooks.onFeedChanged` / `hooks.onFeedRemoved` — optional feed lifecycle hooks (`FeedHooks`), fired by the content write paths.
- `indexing` — optional `IndexingService` port; starts and reconciles resource index runs.
- `agentKinds` — optional map of `AgentKindService` keyed by `agent.session.kind`.

The port interfaces live in `packages/api/orpc/services/` (`agent.service.ts`, `indexing.service.ts`) next to `requireIndexing(context)` / `requireAgentKind(context, kind)`, which answer `SERVICE_UNAVAILABLE` when the context lacks the port. `apps/service` is the only process that runs the router and supplies all of these in `createORPCContext`. Anything that needs a long-lived process, a DB handle or gateway credentials belongs in the app, not here.

**Data access.** oRPC handlers never write raw Drizzle; they call repositories exported as `@chia/db/repos/*`. Write logic shared with workflow steps lives in `packages/api/<domain>/write` (today `feeds/write.ts`) and takes its `FeedHooks` as an explicit argument, so a durable turn can call it with no request to authorize against.

**Errors.** `AppError` codes mirror oRPC's common codes, so a policy failure maps onto `errors[code]()` without translation.

## Package guide

### `api`

`orpc/` — `contracts/`, `routes/`, `guards/`, `services/` (the ports), `router.contract.ts`, `router.ts`, `utils.ts` (`BaseOSContext`, `contractOS`, `baseOS`). Domain modules beside it: `feeds/` (search, access, write), `resources/` (the RAG resource registry and adapters — see [`docs/rag-architecture.md`](../docs/rag-architecture.md)), and external clients each with their own env: `github`, `spotify`, `s3`, `email` (Resend), `betterstack`, `captcha`. `services/env.ts` holds the service-endpoint env the frontends compose.

### `service-kit`

What every service app boots with. `bootstrap.ts` — `createServiceFactory()` (populates `ServiceContext` on each request: headers, client IP, `db`, `kv`, `auth`) and `bootstrap(app)` (logger, Sentry, error handler, body-size cap, CORS, maintenance). `context.ts` — `ServiceContext`, the per-request shape shared by Hono (`c.var`) and oRPC. Plus `policies/`, `adapters/{hono,orpc}.ts`, `errors.ts` (`AppError`, `APP_ERROR_STATUS`), `middlewares/`.

### `db`

Drizzle 1.0 on Postgres. `src/schemas/` — tables and relations, aggregated by `schema.ts` (`./schema`) for Drizzle and Better Auth; `src/libs/` — repositories, exported as `./repos/<domain>`. `src/client.ts` — `connectDatabase(env, { withCache })`, memoized per URL **and** cache setting; the request path uses the `DrizzleCache` (Redis, explicit `$withCache` only), workflow steps ask for `withCache: false`. `src/types.ts` — pure enums (`Locale`, `FeedType`, `Role`, …) safe to import anywhere. Migrations in `.drizzle/`.

### `auth`

Better Auth. `base-auth.ts` — the options (magic link, passkey, API key, admin, organization plugins; `resend` and the email template are imported lazily). `server.ts` — `createAuth(db, kv)`, memoized to one instance per process. `client.ts` / `client.rsc.ts` — the browser and RSC clients; `utils.ts` — cookie helpers and the `X-CH-API-KEY` header name.

### `kv`

Keyv over Redis (also Valkey, Postgres, Upstash adapters). `adapters/redis.ts` exposes `getRedisKv()`, the memoized singleton the request context carries; `drizzle/cache.ts` is the `DrizzleCache` `db` plugs in; `upstash/with-rate-limiter` wraps Upstash's limiter.

### `ai`

Embeddings (`embeddings/`: provider resolution, OpenAI + Ollama, chunking, markdown, `EMBEDDING_INDEX_VERSION`), the Vercel AI SDK content tools (`tools/content`), `utils/model` (`createModel` over the provider SDKs — imported lazily by its callers), and the API-key crypto used by the AI cookie flow (`utils`).

### The agent packages

Read [`docs/agent-architecture.md`](../docs/agent-architecture.md) before touching any of them.

- **`agent-runtime`** — the kind-agnostic runtime on top of Pi's `Agent`: the session tree contract, its Postgres and in-memory implementations and the branch projection (`session/`), turn loop, tool gate, compaction, navigation and event mapping (`pi/`), wire events and replay (`wire/`), model construction with BYOK credentials (`models`), tool-authoring helpers (`tools`). `./pi/*`, `./session/*` and `./models` are **server-only** — they load Pi and the provider SDKs. Browsers and SSR bundles may import `./wire/schema` and `./wire/fold`, which have no Pi dependency; `./wire/replay` is the exception, since classifying provider errors needs pi-ai.
- **`agent-content`** — the read-only content tools every kind that reads the blog shares (`search_posts`, `get_post`, `list_posts`, `list_tags`), the `ContentReadPort` they need, and their names/labels/summaries. Visibility (drafts or published only) is fixed by whichever port the host builds.
- **`agent-writing`** — the writing agent: `web_search`, `fetch_url` and the draft/commit tools on top of the content tools, plus prompts, skills, policy (tool tiers), draft store, model allowlist and its ports — `ContentPort` (the read port plus writes) and `WebPort`. A second agent kind is a sibling package of this one composing `agent-content`.
- **`agent-elements`** — the client side, shared by both frontends. It depends on `@chia/agent-runtime/wire/*`, the contract types, the tool registries and HeroUI; the host passes its own `client.agent` and keeps kind-specific panels (the writing draft preview) on its side.
  - `./store` — `createAgentSessionStore`, a zustand vanilla store per session owning only the live side: folded transcript, connection, the `agent.sessions.chat` stream loop, prompt and approve.
  - `./queries` — TanStack Query options and keys for the server side (session detail, models). The store reads and refreshes them through the host's `QueryClient`, so cache and store never disagree.
  - `./provider` — `AgentSessionProvider` and the hooks over it.
  - `./labels` — `AgentLabels` is the shape of `@chia/i18n/agent-elements/en-US.json`. The host passes its locale's catalog (or a partial override) as `labels`, `setLabels` swaps it on a locale change, and `fill` resolves `{tool}`/`{tier}` templates.
  - `./markdown` — Streamdown with the code and CJK plugins. `markdownComponents` restates inline code, tables, quotes and rules in HeroUI tokens because Streamdown's defaults use shadcn's `muted`; hosts layer more through `components`.
  - `./renderers/content` and `./renderers/web` — per-tool views over the clipped `details` of the content read tools and the writing agent's web tools, keyed by the tool registries' names. A host merges the sets it needs into `Thread`'s `renderers`.
  - One HeroUI element per remaining export (`./thread`, `./message`, `./tool-call`, `./approval-card`, `./composer`, `./model-picker`, …) — see the `exports` map.
  - A host's Tailwind must `@source` this package's `src/**` **and** its `node_modules/{streamdown,@streamdown/*}/dist/*.js` (see `apps/dash/src/app/globals.css`).

### `contents`, `ui`, `editor`, `themes`, `tailwind`, `shaders`

`contents` — MDX rendering with Fumadocs (`content.tsx` / `content.rsc.tsx`, `mdx-components.tsx`, the content context and services). `ui` — shared React components, feature blocks (`./features/*`: email templates, error/not-found pages), HOCs and utils. `editor` — the editor components. `themes` — CSS theme files. `tailwind` — the Tailwind v4 preset and layer CSS. `shaders` — Three.js/WebGL effects.

### `i18n`, `meta`, `utils`

`i18n` — message catalogs: `www/<locale>.json` for `next-intl` in the public site, `agent-elements/<locale>.json` for `@chia/agent-elements` (both apps import their locale's JSON directly; `dash` is English-only and imports `en-US`). Every locale must carry the same keys — `packages/agent-elements/__tests__/labels.test.ts` checks the agent catalogs. `meta` — site metadata authored in Pkl (`meta.pkl` → `meta.json`, needs `pkl` ≥ 0.25.2 to regenerate). `utils` — `config` (service endpoints, `withServiceEndpoint`, base URLs), `request` (ky wrapper), `server` (`errorGenerator`, `getClientIP`), `json` (JSON-safe types, narrowing and stable serialization), `object` (`undefined`-aware object helpers), `query-client` (the shared TanStack Query client), `schema`, `day`, `format`, `is`, `error-helper`.
