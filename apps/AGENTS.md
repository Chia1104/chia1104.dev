# Apps

| App        | Port | Deployment           | Responsibility                                 |
| ---------- | ---- | -------------------- | ---------------------------------------------- |
| `www`      | 3000 | Vercel               | Public profile, content and reader agent       |
| `dash`     | 3001 | Railway              | Authenticated administration and writing agent |
| `service`  | 3005 | Railway              | Auth, data access, oRPC and AI HTTP surfaces   |
| `workflow` | 3008 | Railway, one replica | Durable workflows, steps and agent turns       |

`apps/functions/pg-dump-cron` is the scheduled Postgres-to-S3 backup job.

## Network boundary

- Vercel cannot reach Railway's private network. Resolve endpoints with `withServiceEndpoint` from `@chia/utils/config`.
- Browsers use `NEXT_PUBLIC_SERVICE_PROXY_ENDPOINT`; server runtimes may use internal endpoints.
- Frontends import the oRPC contract type and call `service` directly. Do not add a Next.js API proxy, tRPC or cross-app imports.
- `service` reaches `workflow` through the authenticated `@chia/workflow-control` boundary.

## `www`

- `src/libs/orpc/client.rsc.ts` is server-only and may attach `CH_API_KEY`; the browser client must never receive an API key.
- Browser requests use the Better Auth session cookie and may access only public or caller-owned procedures.
- Content rendering belongs to `@chia/contents`, localization to `@chia/i18n` and shared agent UI to `@chia/agent-elements`.
- Render access from `session.access`; do not infer authorization from failed requests or the raw role column.

## `dash`

- Fetch page data in client components through oRPC query and mutation options. The server client forwards cookies for layout decisions, not page data fetching.
- `dash` has no database, KV, auth server or in-process oRPC context. Server actions are limited to dashboard-owned concerns.
- Dashboard authorization comes from `session.access.dashboard`; operator routes also verify the configured admin identity.
- User administration goes through Better Auth's admin client rather than duplicating its session or ban semantics.

## `service`

- `src/server.ts` mounts Hono on Nitro and `src/bootstrap.ts` applies `@chia/service-kit/bootstrap`.
- Keep HTTP mounts in `routes/`, oRPC context construction in `factories/orpc.factory.ts`, host bindings in `agents/`, transport guards in `guards/`, orchestration in `services/` and remote access in `repos/`.
- Business logic belongs in packages. Database access goes through `@chia/db/repos/*`.
- The service starts, resumes and cancels workflows but never executes them.
- Keep heavy provider and agent dependencies behind dynamic imports so route imports stay lightweight.

## `workflow`

- This is the only durable-workflow executor. Keep it at one replica unless `docs/workflow-deployment.md` changes.
- Workflow functions orchestrate only; Node built-ins, database access, providers and other side effects belong in steps.
- Keep workflow filenames and exported function names stable because existing runs resume by their SDK-derived IDs.
- Shared contracts and agent behavior belong in packages, not another app.
