# Apps

| App            | Stack                                       | Port | Runs on | Role                                                                    |
| -------------- | ------------------------------------------- | ---- | ------- | ----------------------------------------------------------------------- |
| `apps/www`     | Next.js 16 (App Router, React 19)           | 3000 | Vercel  | Public site — profile, blog, projects, contact                          |
| `apps/dash`    | Next.js 16                                  | 3001 | Railway | Admin dashboard — feeds/content, assets, RAG, agent, API keys, projects |
| `apps/service` | Hono on Nitro (node-server preset, Node 26) | 3005 | Railway | The only backend. Owns auth, DB, workflows, AI/agent runtime            |

`apps/functions/pg-dump-cron` is a Bun script on a schedule that dumps Postgres to S3, with its own Dockerfile. `apps/ai`, `apps/auth` and `apps/workflow` are env-only placeholders for a future split of `service` — nothing runs there.

## The deployment split

`www` runs on **Vercel**; `dash` and `service` run on **Railway**. A Vercel deployment cannot reach Railway's private network, and that asymmetry decides how each frontend talks to `service`.

`withServiceEndpoint(path, Service.X, { isInternal, version })` from `@chia/utils/config` resolves `INTERNAL_*_ENDPOINT` on a server runtime and `NEXT_PUBLIC_SERVICE_PROXY_ENDPOINT` in the browser.

Both frontends import only the **contract type** from `@chia/api/orpc/contracts` and get an end-to-end typed client — they call `service` directly, with no tRPC and no Next.js API-route proxy layer. The only Next route handlers that exist are `/api/v1/health` in each app.

## `apps/www`

Public Next.js site. Two oRPC clients, because of the split above:

- `src/libs/orpc/client.rsc.ts` — server-only. Hits `service` over the public network and sends `x-ch-api-key` (`CH_API_KEY`) plus the Cloudflare bypass token.
- `src/libs/orpc/client.ts` — browser. **No API key ever reaches the browser**; it may only call public procedures. If the browser needs something, expose it as a public procedure rather than leaking the key.

Content is MDX rendered through `@chia/contents` (Fumadocs); i18n through `next-intl` with messages in `packages/i18n/www`.

## `apps/dash`

Admin dashboard, on one oRPC client: `src/libs/orpc/client.ts`, an `RPCLink` with `credentials: "include"`. **Every procedure call is made from the browser** with the session cookie. Pages are thin server shells (`server-only` + `force-dynamic`) or `"use client"` pages, and data fetching lives in client components via `orpc.*.queryOptions` / `mutationOptions`. There is no server-side or in-process oRPC path, so `dash` holds no DB, KV or auth-server context of its own and needs no `DATABASE_URL`.

Under `src/`: `components` (feature UI — feed, rag, agent composed from `@chia/agent-elements` plus the writing draft preview, projects, assets, settings), `containers` (client containers that fetch and mount a view), `store` (zustand — draft/edit state, organization), `resources` (typed wrappers over the non-oRPC `/ai` routes), `server` (`next-safe-action` actions — today only the `currentOrg` cookie; no oRPC there).

Auth is a Better Auth session; the client comes from `@chia/auth/client`.

## `apps/service`

The only backend. Hono mounted on Nitro; `src/server.ts` composes the app, `src/bootstrap.ts` applies the shared middleware from `@chia/service-kit/bootstrap`.

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
- `factories/orpc.factory.ts` — `createORPCContext(c)`, **the one place the oRPC context is built**. Spreads the Hono `c.var` (`ServiceContext`) and adds what this process supplies: `config` (rate-limit budget, project id, AI key material — from env), `hooks` (feed indexing + Sentry error sink), `indexing`, `memory`, `agentKinds`, `agentAdmin`. See "Context injection" in [`packages/AGENTS.md`](../packages/AGENTS.md).
- `agents/` — the agent kinds this process serves. `registry.ts` (`AGENT_KINDS`, `agentKinds`, `loadAgentKind`) is the one place a kind is registered and is boot-safe: it restates each kind's `minTier` for the guards and loads the definition with a dynamic import. `kind.ts` is the `AgentKindDefinition` contract, `service.ts` the generic `AgentKindService` over a definition, and `writing.ts` the writing kind — its domain package bound to the host's ports. `tasks.ts` (`AGENT_TASKS`, `resolveAgentTask`) registers the one-shot model calls beside a session (title, compaction, branch summary, lesson extraction); `config.ts` resolves a kind's effective defaults and config from `agent.kind_config`; `admin.ts` is the `AgentAdminService` behind the dashboard's agent workspace. A new kind is a sibling of `writing.ts` plus one registry entry; see [`docs/agent-architecture.md`](../docs/agent-architecture.md) §2 and §13.
- `guards/` — Hono middleware bound from the shared policies via `toHonoMiddleware` (`verifyAuth`, `rateLimiterGuard`, `ai`).
- `services/` — host-side implementations of the ports `packages/api` declares:
  - `feed-indexing.service.ts` (`feedHooks`), `rag-indexing.service.ts` (`ragIndexingService`)
  - `content-read.port.ts` — the `ContentReadPort`, built per visibility (`author` or `public`)
  - `agent-content.port.ts` (the writing agent's content port: author-visibility reads plus writes), `agent-web.port.ts` (its `WebPort`: Firecrawl search and scrape), `agent-credentials.ts`, `agent-admin.service.ts` (lazy `AgentAdminService` delegate over `agents/admin.ts`)
- `workflows/` and `steps/` — durable workflows (Vercel Workflow SDK, `"use workflow"` / `"use step"`): feed indexing, feed removal, resource index/reindex, and the agent session driver. Workflow functions run in a sandbox with no Node built-ins; anything real happens in a step.
- `plugins/` — Nitro plugins that start the workflow world (Postgres or Redis) at boot.

**Boot path is a memory budget.** The process loads what the router reaches at module scope. Heavy dependencies (`@ai-sdk/*`, `resend`, `@aws-sdk/client-s3`, the agent runtime) are reached through dynamic imports at first use; keep it that way when adding a route.

Deployed via `Dockerfile.node-service` (Node 26 alpine, `turbo prune`); `infra/railway/service.json` holds the Railway config.
