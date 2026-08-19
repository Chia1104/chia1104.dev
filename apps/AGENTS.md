# Apps

Read the root [`AGENTS.md`](../AGENTS.md) first for the engineering rules, commands and conventions. This file describes each deployable and how they are wired together. The shared packages are described in [`packages/AGENTS.md`](../packages/AGENTS.md).

| App            | Stack                                       | Port | Runs on | Role                                                                    |
| -------------- | ------------------------------------------- | ---- | ------- | ----------------------------------------------------------------------- |
| `apps/www`     | Next.js 16 (App Router, React 19)           | 3000 | Vercel  | Public site — profile, blog, projects, contact                          |
| `apps/dash`    | Next.js 16                                  | 3001 | Railway | Admin dashboard — feeds/content, assets, RAG, agent, API keys, projects |
| `apps/service` | Hono on Nitro (node-server preset, Node 26) | 3005 | Railway | The only backend. Owns auth, DB, workflows, AI/agent runtime            |

The rest of `apps/`:

- `apps/gateway` — Caddy and Nginx configs that front the three apps.
- `apps/functions/pg-dump-cron` — a Bun script on a schedule that dumps Postgres to S3. Its own Dockerfile.
- `apps/ai`, `apps/auth`, `apps/workflow` — env-only placeholders for a future split of `service`. Nothing runs there.

`legacy/` at the repo root is dead code kept for reference — lint-ignored, never imported.

## The deployment split

`www` runs on **Vercel**; `dash` and `service` run on **Railway**. A Vercel deployment cannot reach Railway's private network, and that asymmetry decides how each frontend talks to `service`.

Endpoint resolution always goes through `withServiceEndpoint(path, Service.X, { isInternal, version })` from `@chia/utils/config`. On a server runtime it resolves `INTERNAL_*_ENDPOINT`; in the browser it resolves `NEXT_PUBLIC_SERVICE_PROXY_ENDPOINT`. Never hand-build a service URL.

Both frontends import only the **contract type** from `@chia/api/orpc/contracts` and get an end-to-end typed client. There is no tRPC and no Next.js API-route proxy layer — the frontends call `service` directly. The only Next route handlers that exist are `/api/v1/health` in each app.

## `apps/www`

Public Next.js site. Two oRPC clients, because of the split above:

- `src/libs/orpc/client.rsc.ts` — server-only. Hits `service` over the public network and sends `x-ch-api-key` (`CH_API_KEY`) plus the Cloudflare bypass token.
- `src/libs/orpc/client.ts` — browser. **No API key ever reaches the browser**; it may only call public procedures. If the browser needs something, expose it as a public procedure rather than leaking the key.

Content is MDX rendered through `@chia/contents` (Fumadocs); i18n through `next-intl` with messages in `packages/i18n/www`. E2E tests live in `tests/www-e2e` (Playwright).

## `apps/dash`

Admin dashboard. One oRPC client:

- `src/libs/orpc/client.ts` — an `RPCLink` with `credentials: "include"`. **Every procedure call is made from the browser** with the session cookie. Pages are thin server shells (`server-only` + `force-dynamic`) or `"use client"` pages, and data fetching lives in client components via `orpc.*.queryOptions` / `mutationOptions`. There is no server-side or in-process oRPC path, so `dash` holds no DB, KV or auth-server context of its own and needs no `DATABASE_URL`.

Layout: `src/app` (routes), `src/components` (feature UI: feed, rag, agent — composed from `@chia/agent-elements` plus the writing draft preview —, projects, assets, settings), `src/containers` (client containers that fetch and mount a view), `src/store` (zustand — draft/edit state, organization), `src/hooks`, `src/resources` (typed wrappers over the non-oRPC `/ai` routes), `src/server` (`next-safe-action` actions — today only the `currentOrg` cookie; no oRPC there).

Auth is a Better Auth session; the client comes from `@chia/auth/client`.

## `apps/service`

The only backend. Hono mounted on Nitro; `src/server.ts` composes the app, `src/bootstrap.ts` applies the shared middleware from `@chia/service-kit/bootstrap` (logger, Sentry, error handler, body-size cap, CORS, maintenance mode).

**Surface** (all under `/api/v1`):

```
/auth      Better Auth handler
/rpc       oRPC RPC handler — the main surface
/health
/ai        Vercel AI SDK routes (streaming generation, provider-key cookies)
/spotify   OAuth callback only; the reads are oRPC procedures
```

**Layout** (`src/`):

- `routes/*.route.ts` — one Hono sub-app per surface above. `rpc.route.ts` mounts the oRPC router with the request timeout, coarse rate limit and the context below.
- `factories/orpc.factory.ts` — `createORPCContext(c)`, **the one place the oRPC context is built**. Spreads the Hono `c.var` (`ServiceContext`) and adds what this process supplies: `config` (rate-limit budget, project id, AI key material — from env), `hooks` (feed indexing + Sentry error sink), `indexing`, `agentKinds`. See "Context injection" in `packages/AGENTS.md`.
- `guards/` — Hono middleware bound from the shared policies via `toHonoMiddleware` (`verifyAuth`, `rateLimiterGuard`, `ai`).
- `services/` — host-side implementations of the ports `packages/api` declares: `feed-indexing.service.ts` (`feedHooks`), `rag-indexing.service.ts` (`ragIndexingService`), `agent.service.ts` (`agentKinds`, a lazy delegate so `@chia/agent-writing` and the provider SDKs stay out of the boot path) and `writing-agent.service.ts` (the real thing), plus `content-read.port.ts` (the `ContentReadPort`, built per visibility — `author` or `public`), `agent-content.port.ts` (the writing agent's content port: author-visibility reads plus writes), `agent-web.port.ts` (its `WebPort`: Firecrawl search and scrape) and `agent-credentials.ts`.
- `workflows/` and `steps/` — durable workflows (Vercel Workflow SDK, `"use workflow"` / `"use step"`): feed indexing, feed removal, resource index/reindex, and the agent session driver. Workflow functions run in a sandbox with no Node built-ins; anything real happens in a step.
- `plugins/` — Nitro plugins that start the workflow world (Postgres or Redis) at boot.

**Boot path is a memory budget.** The process loads what the router reaches at module scope. Heavy dependencies (`@ai-sdk/*`, `resend`, `@aws-sdk/client-s3`, the agent runtime) are reached through dynamic imports at first use; keep it that way when adding a route.

**Env**: `src/env.ts` composes the package envs (`@chia/db/env`, `@chia/kv/env`, `@chia/auth/env`, …) with the app's own. Deployed via `Dockerfile.node-service` (Node 26 alpine, `turbo prune`); `infra/railway/service.json` holds the Railway config.

Before touching the agent or RAG subsystems read [`docs/agent-architecture.md`](../docs/agent-architecture.md) and [`docs/rag-architecture.md`](../docs/rag-architecture.md).
