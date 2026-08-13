# Chia1104.dev

## Engineering rules

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.

Comments carry necessary information only — what a reader cannot get from the code itself (why a constraint exists, what invariant is being held). No narrative about how a design was reached.

## What this is

Chia1104's personal site, as a pnpm + Turborepo monorepo. Single maintainer, no team and no external consumers.

It doubles as the place where new stack and architecture ideas get tried for real, which shapes how work is done here:

- **Bleeding-edge dependencies are the point, not an accident.** Next 16, React 19, Drizzle 1.0 RCs, oRPC, Nitro, workflow runtimes. Do not "downgrade to something stable" or route around a new API to avoid learning it — read its docs and types first (see the rules above).
- **Minimal but extensible is the target shape.** Ship the smallest thing that works end to end, and put the seam where the next capability will attach — a contract, a policy, a port, a repository. Extensibility means a clean seam, not a config flag or a plugin system nobody asked for.
- **Nothing needs to be kept for compatibility.** There is one deploy of each app and one consumer of every internal API, so obsolete code gets deleted outright. Migrating both sides of a contract in the same change is normal and preferred.

| App | Stack | Role |
| --- | --- | --- |
| `apps/www` | Next.js 16 (App Router, React 19), port 3000 | Public site — profile, blog, projects, contact |
| `apps/dash` | Next.js 16, port 3001 | Admin dashboard — feeds/content, assets, RAG, agent, API keys, projects |
| `apps/service` | Hono on Nitro, port 3005 | The only backend. Owns auth, DB, workflows, AI/agent runtime |

`apps/gateway` is Caddy/Nginx config, `apps/functions/pg-dump-cron` is a scheduled job, and `apps/ai` / `apps/auth` / `apps/workflow` are env-only placeholders for a future split of `service`. `legacy/` is dead code kept for reference — it is lint-ignored and must not be imported.

## API architecture

**Contract-first oRPC.** The wire contract lives in `packages/api/orpc/contracts/*.contract.ts` and is composed in `router.contract.ts`. Handlers live in `packages/api/orpc/routes/*.route.ts` and are composed in `router.ts` via `contractOS` (`implement(routerContract)`). The two trees must stay key-for-key identical.

`apps/service` mounts that router; both frontends import the *contract type* only and get an end-to-end typed client. There is no tRPC and no Next.js API-route proxy layer — the frontends call `service` endpoints directly. The only Next route handlers that exist are `/api/v1/health` in each app.

**Service surface** (`apps/service/src/server.ts`, all under `/api/v1`):

```
/auth      Better Auth handler
/rpc       oRPC RPC handler (the main surface)
/health
/ai
/spotify
/          openapi catch-all — serves the same oRPC router over REST
```

`openapiRoutes` is mounted last on purpose: hand-written Hono routes keep precedence, so a Hono route can be replaced by an oRPC procedure at the same URL without a flag day.

**Guards and policies.** Authorization logic lives once in `packages/service-kit/src/policies` (`sessionPolicy`, `apiKeyPolicy`, `adminPolicy`, `rateLimitPolicy`, `captchaPolicy`, `aiKeyPolicy`) and is bound to each transport by a thin adapter: `toHonoMiddleware` for Hono middleware (`apps/service/src/guards/`), `runPolicy` for oRPC middleware (`packages/api/orpc/guards/`). Write new authorization as a policy, not as a guard.

**Config injection.** `packages/api` parses no env of its own. The hosting app calls `configureORPC({ rateLimit, projectId, aiAuthPrivateKey })` once at boot (`apps/service/src/factories/orpc.factory.ts`); domain side effects are registered the same way via `registerFeedEventListeners`, `registerAgentRuntimeService`, `registerRagIndexingService` in `rpc.route.ts`. Anything needing a long-lived process, a DB handle, or gateway credentials belongs in the app, not in `packages/api`.

**Data access.** oRPC handlers never write raw Drizzle queries; they call repositories exported as `@chia/db/repos/*`. Write logic shared with workflow steps lives in `packages/api/<domain>/write` so a durable turn can call it without a request to authorize against.

## Client wiring and the deployment split

`www` runs on **Vercel**; `dash` and `service` run on **Railway**. That asymmetry is the reason there are two client files per app.

`apps/www`:

- `libs/orpc/client.rsc.ts` — server-only. Hits `service` over the network and sends `x-ch-api-key` (`CH_API_KEY`) plus the Cloudflare bypass token, because a Vercel deployment cannot reach Railway's private network.
- `libs/orpc/client.ts` — browser. **No API key ever reaches the browser**; it may only call public procedures. If the browser needs something, expose it as a public procedure rather than leaking the key.

`apps/dash`:

- `libs/orpc/client.rsc.ts` — imported for side effects by `app/layout.tsx` and `instrumentation.ts`. It sets `globalThis.$client` to a `createRouterClient(router)`, so server-side dash calls the router **in-process** (its own DB/auth context) instead of over HTTP.
- `libs/orpc/client.ts` — falls back to `globalThis.$client` when set, otherwise an `RPCLink` with `credentials: "include"`; the browser talks to `service` with session cookies. Railway's private network is what makes the network path cheap here.

Endpoint resolution goes through `withServiceEndpoint(path, Service.X, { isInternal, version })` in `packages/utils/src/config`. On a server runtime it resolves `INTERNAL_*_ENDPOINT`; in the browser it resolves `NEXT_PUBLIC_SERVICE_PROXY_ENDPOINT`. Never hand-build a service URL.

**Auth.** Better Auth (`packages/auth`) with sessions in Redis, plus API keys and passkeys. Two authentication modes coexist: session cookies (dash users) and the `X-CH-API-KEY` header scoped to a `PROJECT_ID` (deployment-to-deployment).

## Layout

```
apps/          www, dash, service (+ gateway, functions, placeholders)
packages/
  api/         oRPC contracts+routes+guards, plus external clients
               (github, spotify, s3, resend/email, betterstack, captcha)
  db/          Drizzle schemas (src/schemas) + repositories (src/libs, exported as ./repos/*)
  service-kit/ bootstrap, Hono/oRPC context, policies, transport adapters, AppError
  auth/        Better Auth config and clients
  ai/          embeddings, ollama, AI tools
  agent-core/  agent session model, ports, permissions, events
  agent-runtime/, agent-writing/   runtime + the writing agent
  contents/    MDX rendering (Fumadocs)
  ui/, editor/, themes/, tailwind/, shaders/, i18n/, kv/, meta/, utils/
tests/www-e2e  Playwright
toolings/      shared tsconfig / lint / vitest / scripts
docs/          agent-architecture.md, rag-architecture.md (zh)
infra/railway/ per-service railway.json
```

## Commands

```bash
pnpm dev:www          # www + service      pnpm dev:dash / dev:service / dev (all)
pnpm build:www        # build:dash / build:service / build
pnpm lint             # oxlint             pnpm lint:fix
pnpm format           # oxfmt              pnpm format:check
pnpm type:check       # tsc --noEmit across the graph
pnpm test             # vitest run         pnpm test:watch / test:ui
pnpm test:e2e         # playwright
pnpm db:up            # local postgres + redis via docker
pnpm db:generate / db:migrate / db:push / db:seed / db:studio
```

`make help` lists the same targets. `make init` copies the three `.env.example` files.

Filter a single workspace with `pnpm turbo run <task> --filter <name>...`. Prefer running `lint`/`type:check` scoped to what you touched.

## Conventions

- **Dependency versions live in the pnpm catalogs** in `pnpm-workspace.yaml` (`catalog:`, `catalog:ai`, `catalog:orpc`, …). Add a version there and reference the catalog — never pin a version inline in a package.json. Internal packages use `workspace:*` (enforced by manypkg).
- **Package exports are source, not build output.** `@chia/*` packages export `./src/...ts` directly and are transpiled by the consumer. Adding a new entry point means adding it to that package's `exports` map.
- **Env is validated with `@t3-oss/env-*`**, one `env.ts` per app/package, composed with `extends: [...]`. Add a variable to the owning package's schema, not to a consumer. Turbo needs new global vars listed in `turbo.json` `globalEnv`/`globalPassThroughEnv`.
- **Lint/format is oxlint + oxfmt**, not ESLint/Prettier. Husky + lint-staged runs oxfmt on commit.
- **Tests** are Vitest (`__tests__/` or `*.test.ts` beside source), configured per workspace and aggregated by the root `vitest.config.ts`. E2E is Playwright in `tests/www-e2e`.
- **Errors**: throw `AppError` from `@chia/service-kit/errors` in domain code, convert at the edge with `toORPCError` / `isAppError`.
- Branch off and PR into `develop`.

## Deep dives

Read these before touching the agent or RAG subsystems — both have non-obvious invariants (durable workflow turns, approval handshake, chunk/embedding versioning):

- [`docs/agent-architecture.md`](docs/agent-architecture.md) — layering, turn flow, streaming, approvals, the writing agent
- [`docs/rag-architecture.md`](docs/rag-architecture.md) — chunking, embeddings, index runs, reindex operations
