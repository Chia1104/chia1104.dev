# Apps

| App        | Port | Deployment           | Responsibility                                                |
| ---------- | ---- | -------------------- | ------------------------------------------------------------- |
| `www`      | 3000 | Vercel               | Public profile, blog, projects and contact                    |
| `dash`     | 3001 | Railway              | Admin UI for users, content, assets, RAG, agents and settings |
| `service`  | 3005 | Railway              | Auth, database access, oRPC and AI HTTP routes                |
| `workflow` | 3008 | Railway, one replica | Durable workflows, steps and agent turns                      |

`apps/functions/pg-dump-cron` is the scheduled Postgres-to-S3 backup job.

## Network boundary

Vercel cannot reach Railway's private network. Resolve endpoints with `withServiceEndpoint(path, service, options)` from `@chia/utils/config`:

- Server runtimes use the internal endpoint when available.
- Browsers use `NEXT_PUBLIC_SERVICE_PROXY_ENDPOINT`.
- `service` reaches `workflow` over Railway's private network.

The frontends import only the contract type from `@chia/api/orpc/contracts` and call `service` directly. Do not add tRPC, a Next.js API proxy or cross-app imports.

## `www`

- `src/libs/orpc/client.rsc.ts` is server-only and sends `CH_API_KEY` plus the Cloudflare bypass token.
- `src/libs/orpc/client.ts` runs in the browser with the session cookie and may call only public procedures and the visitor's own agent sessions. Never expose an API key to it.
- Public agent chat lives in `src/components/agent/` and uses `@chia/agent-elements` content renderers only. Guest sessions come from better-auth's anonymous plugin and require the site captcha before minting. `@chia/ui/captcha` is the shared challenge widget.
- Content uses `@chia/contents`; localization uses `next-intl` with `packages/i18n/www`.

## `dash`

All oRPC calls run in the browser through `src/libs/orpc/client.ts` with the Better Auth session cookie. Keep pages as thin server shells or client pages, and fetch data in client components through oRPC query and mutation options.

`dash` has no database, KV, auth-server or in-process oRPC context. Server actions are limited to dashboard-owned server concerns.

User administration writes through better-auth's admin client. Do not duplicate ban or session semantics. Admin access is the configured admin id, not the `role` column.

## `service`

`src/server.ts` mounts Hono on Nitro; `src/bootstrap.ts` applies `@chia/service-kit/bootstrap`. Its `/api/v1` surface is:

```text
/auth      Better Auth; guest, social and magic-link sign-in require `x-captcha-response`
/rpc       oRPC
/health
/ai        Vercel AI SDK streaming routes; `key:signed` also admits guests
/spotify   OAuth callback
```

Keep these boundaries under `src/`:

- `routes/` mounts HTTP surfaces.
- `factories/orpc.factory.ts` is the only place that builds the oRPC context.
- `agents/` contains host bindings and dynamic agent-kind loaders; business logic belongs in `packages/api`.
- `guards/` binds shared policies to Hono.
- `services/` orchestrates host-side ports; `repos/` owns remote access. Table access belongs in `@chia/db/repos`.

`service` never executes workflows. Starts, resumes and cancellations go through the context's `@chia/workflow-control` client; run state and streams use shared World storage. See [`docs/workflow-deployment.md`](../docs/workflow-deployment.md).

Keep heavy dependencies behind dynamic imports so route imports do not inflate the boot path.

## `workflow`

This is the only durable-workflow executor. It exposes `/health` and the authenticated workflow-control route. Keep it at one replica unless the design in [`docs/workflow-deployment.md`](../docs/workflow-deployment.md) is changed.

- `workflow-control.route.ts` validates commands and authentication; `services/workflow-control.ts` executes start, resume and cancel operations.
- `workflows/` contains durable orchestration; `steps/` contains side effects. Workflow functions cannot use Node built-ins.
- Keep workflow filenames and exported function names stable because existing runs resume by the SDK-derived ID.
- `agents/` supplies execution-time host bindings. Shared contracts and behavior belong in `@chia/agent-host` and `@chia/workflow-control`, never another app.
- Packages reached by step code may need to be direct `apps/workflow` dependencies. Otherwise esbuild can inline CommonJS dependencies into invalid ESM during `nitro dev`.
