# Apps

| App             | Stack                                       | Port | Runs on | Role                                                                    |
| --------------- | ------------------------------------------- | ---- | ------- | ----------------------------------------------------------------------- |
| `apps/www`      | Next.js 16 (App Router, React 19)           | 3000 | Vercel  | Public site — profile, blog, projects, contact                          |
| `apps/dash`     | Next.js 16                                  | 3001 | Railway | Admin dashboard — feeds/content, assets, RAG, agent, API keys, projects |
| `apps/service`  | Hono on Nitro (node-server preset, Node 26) | 3005 | Railway | The API backend. Owns auth, DB, the oRPC surface, AI routes             |
| `apps/workflow` | Hono on Nitro (node-server preset, Node 26) | 3008 | Railway | The workflow runner — durable workflows, steps, the agent turn executor |

`apps/functions/pg-dump-cron` is a Bun script on a schedule that dumps Postgres to S3, with its own Dockerfile. `apps/ai` and `apps/auth` are env-only placeholders for a future split of `service` — nothing runs there.

## The deployment split

`www` runs on **Vercel**; `dash`, `service` and `workflow` run on **Railway**. A Vercel deployment cannot reach Railway's private network, and that asymmetry decides how each frontend talks to `service`.

`withServiceEndpoint(path, Service.X, { isInternal, version })` from `@chia/utils/config` resolves `INTERNAL_*_ENDPOINT` on a server runtime and `NEXT_PUBLIC_SERVICE_PROXY_ENDPOINT` in the browser.

Both frontends import only the **contract type** from `@chia/api/orpc/contracts` and get an end-to-end typed client — they call `service` directly, with no tRPC and no Next.js API-route proxy layer. The only Next route handlers that exist are `/api/v1/health` in each app.

## `apps/www`

Public Next.js site. Two oRPC clients, because of the split above:

- `src/libs/orpc/client.rsc.ts` — server-only. Hits `service` over the public network and sends `x-ch-api-key` (`CH_API_KEY`) plus the Cloudflare bypass token.
- `src/libs/orpc/client.ts` — browser. **No API key ever reaches the browser**; it may only call public procedures. If the browser needs something, expose it as a public procedure rather than leaking the key.

Content is MDX rendered through `@chia/contents` (Fumadocs); i18n through `next-intl` with messages in `packages/i18n/www`.

## `apps/dash`

Admin dashboard, on one oRPC client: `src/libs/orpc/client.ts`, an `RPCLink` with `credentials: "include"`. **Every procedure call is made from the browser** with the session cookie. Pages are thin server shells (`server-only` + `force-dynamic`) or `"use client"` pages, and data fetching lives in client components via `orpc.*.queryOptions` / `mutationOptions`. There is no server-side or in-process oRPC path, so `dash` holds no DB, KV or auth-server context of its own and needs no `DATABASE_URL`.

Under `src/`: `components` (feature UI — feed, rag, agent composed from `@chia/agent-elements` plus the writing draft preview, agents — the `/agents` workspace of kind and task overrides, react-hook-form over the `agent.admin.*` contract — memory, projects, assets, settings), `containers` (client containers that fetch and mount a view), `store` (zustand — draft/edit state, organization), `resources` (typed wrappers over the non-oRPC `/ai` routes), `server` (`next-safe-action` actions — today only the `currentOrg` cookie; no oRPC there).

Auth is a Better Auth session; the client comes from `@chia/auth/client`.

## `apps/service`

The API backend. Hono mounted on Nitro; `src/server.ts` composes the app, `src/bootstrap.ts` applies the shared middleware from `@chia/service-kit/bootstrap`.

It runs no workflows. Every workflow start, hook resume and cancel is a command sent to
`apps/workflow` through `repos/workflow-control.repo.ts` (`@chia/workflow-control/contract`); run
state and durable streams are read straight from the shared World storage. See
[`docs/workflow-deployment.md`](../docs/workflow-deployment.md).

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
- `factories/` — what this process registers globally, built once at boot. `orpc.factory.ts` is `createORPCContext(c)`, **the one place the oRPC context is built**: it spreads the Hono `c.var` (`ServiceContext`) and adds what this process supplies — `config` (rate-limit budget, project id, AI key material — from env), `hooks` (feed + memory indexing, Sentry error sink), `indexing`, `memory`, `agentKinds`, `agentAdmin`. `agent-admin.factory.ts` is the lazy `AgentAdminService` delegate over `agents/admin.ts`, deferred because the implementation loads every kind and the provider stack. See "Context injection" in [`packages/AGENTS.md`](../packages/AGENTS.md).
- `agents/` — the agent kinds this process serves. `registry.ts` (`AGENT_KINDS`, `agentKinds`, `loadAgentKind`) is the one place a kind is registered and is boot-safe: it restates each kind's `minTier` for the guards and loads the definition with a dynamic import. `service.ts` is the generic `AgentKindService` over a definition, `writing.ts` binds the writing kind without an execution host (this process seeds drafts and serves the session API, it never runs a turn), and `admin.ts` is the `AgentAdminService` behind the dashboard's agent workspace. The kind contract, task registry and config resolution live in `@chia/agent-host` so `apps/workflow` shares them. A new kind is a sibling of `writing.ts` here and in `apps/workflow/src/agents/`, plus one registry entry; see [`docs/agent-architecture.md`](../docs/agent-architecture.md) §2 and §13.
- `guards/` — Hono middleware bound from the shared policies via `toHonoMiddleware` (`verifyAuth`, `rateLimiterGuard`, `ai`).
- `services/` — `*.service.ts`, the host-side implementations of the ports `packages/api` declares and the orchestration behind them; they decide _when_ something happens and delegate storage and remote access to `repos/`:
  - `feed-indexing.service.ts` (`feedHooks`), `agent-memory-indexing.service.ts` (`memoryHooks`) — the lifecycle hooks, which start runs through `workflowControl`
  - `agent-abort-controller.service.ts`, `agent-credentials.service.ts` (cookie → encrypted BYOK credentials at the HTTP boundary, decryption at the last moment), `spotify.service.ts`
- `repos/` — `*.repo.ts`, this app's remote access, one file per thing accessed. `workflow-control.repo.ts` is the env-bound `@chia/workflow-control/client` instance: the private endpoint resolved by `withServiceEndpoint` plus the shared bearer token. It goes on the oRPC context as `workflow`, so the routes in `packages/api` start, cancel and reconcile runs themselves with `context.db` and `context.workflow`. Pure table access stays in `@chia/db/repos`.

**Boot path is a memory budget.** The process loads what the router reaches at module scope. Heavy dependencies (`@ai-sdk/*`, `resend`, `@aws-sdk/client-s3`, the agent runtime) are reached through dynamic imports at first use; keep it that way when adding a route.

Deployed via `Dockerfile.service` / `Dockerfile.node-service` (`turbo prune --scope=service`); `infra/railway/service.json` holds the Railway config.

## `apps/workflow`

The workflow runner, and the only process that executes durable workflows. Hono on Nitro with the `workflow/nitro` module; `src/server.ts` exposes only `/health` and the authenticated control route at `/`; `service` resolves it with `withServiceEndpoint("/", Service.Workflow, { isInternal: true })` over the private network. Single replica by design — [`docs/workflow-deployment.md`](../docs/workflow-deployment.md) explains why and what it would take to change.

**Layout** (`src/`):

- `workflow-control.route.ts` — validates a `WorkflowControlCommand` and the bearer token; `services/workflow-control.ts` executes it in-process (`start`, hook `resume`, `cancel`) and is also what steps call when they start another run.
- `workflows/` and `steps/` — durable workflows (Vercel Workflow SDK, `"use workflow"` / `"use step"`): feed indexing, feed removal, resource index/reindex, memory consolidation, the agent abort controller and the agent session driver. Workflow functions run in a sandbox with no Node built-ins; anything real happens in a step. Keep file names and exported function names stable: the SDK derives the workflow id from `./src/workflows/<file>//<export>` and existing durable runs resume by that id.
- `agents/` — `registry.ts` (`loadAgentKind`) and `writing.ts`, the writing kind bound to its execution host: content port (`services/agent-content.port.ts`), web port (`agent-web.port.ts`), memory port (`agent-memory.port.ts`), credentials, and memory consolidation through `workflowControl`.
- `plugins/start-workflow-world.ts` — starts the SDK's singleton World (`getWorld().start()`), which brings up the Graphile runner and re-enqueues open runs, and calls `world.close()` on the Nitro `close` hook.

Shared pieces live in packages, never imported across apps: `@chia/agent-host` (kind contract, tasks, config, `ContentReadPort`, the writing kind factory) and `@chia/workflow-control` (command contract and the agent hook schemas/tokens both processes need).

**The step bundle and third-party packages.** `workflow/nitro` bundles `src/steps` with esbuild into one ESM file. A bare import it can resolve from `apps/workflow` itself stays a bare import and Node loads the package; one it cannot — a package reached only through a `@chia/*` dependency — is inlined, and the relative `require()` calls inside an inlined CommonJS package are rewritten to paths that ESM cannot `require` (`Dynamic require of "…" is not supported`). The production build survives because Nitro's rolldown pass re-bundles the file; `nitro dev` loads it from disk and does not. So a CommonJS package that step code reaches (today `ai`, whose `@ai-sdk/gateway` loads `@vercel/oidc`) is declared here as a direct dependency as well, the way `apps/service` declares it.

Deployed via `Dockerfile.workflow` (Node 26 alpine, `turbo prune --scope=workflow-service`); `infra/railway/workflow.json` holds the Railway config with `numReplicas: 1`.
