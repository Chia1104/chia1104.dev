# Chia1104.dev

Chia1104's personal site, as a pnpm + Turborepo monorepo. Single maintainer, no team, no external consumers — and the place where new stack and architecture ideas get tried for real. That shapes every rule below.

## Engineering rules

- **Delete obsolete paths outright.** There is one deploy of each app and one consumer of every internal API, so nothing needs a compatibility layer, fallback or migration shim. Migrating both sides of a contract in the same change is normal and preferred.
- **Ship the smallest thing that works end to end**, then add each capability on top of a product that already works. Avoid speculative abstraction, configuration and indirection.
- **Put the seam where the next capability will attach** — a contract, a policy, a port, a repository. Extensibility means a clean seam, not a config flag or a plugin system nobody asked for.
- **Bleeding-edge dependencies are the point, not an accident.** Next 16, React 19, Drizzle 1.0 RCs, oRPC, Nitro, workflow runtimes. Read a new API's docs and types rather than downgrading or routing around it.
- **Reach for what the repo already depends on** before writing your own or adding a package, and check a library's docs and types before assuming it lacks a capability.
- **Decide for the long term.** A stopgap that only works for now and is meant to be replaced later is not acceptable.

Comments carry only what the code cannot: why a constraint exists, what invariant is held. No narrative about how a design was reached.

## Deployables

`apps/www` (public site, Next.js, Vercel), `apps/dash` (admin dashboard, Next.js, Railway) and `apps/service` (the only backend — Hono on Nitro, Railway; owns auth, DB, workflows, the AI/agent runtime). Both frontends reach `service` through a contract-first oRPC client.

- [`apps/AGENTS.md`](apps/AGENTS.md) — the deployment split, how each frontend reaches `service`, the service surface and its internal layout.
- [`packages/AGENTS.md`](packages/AGENTS.md) — the API architecture (contracts, policies, context injection, data access, errors) and every `@chia/*` package.
- [`docs/agent-architecture.md`](docs/agent-architecture.md) and [`docs/rag-architecture.md`](docs/rag-architecture.md) — read before touching the agent or RAG subsystems; both hold non-obvious invariants (durable workflow turns, approval handshake, chunk/embedding versioning).

Also in the tree: `apps/gateway` (Caddy and Nginx configs fronting the three apps), `apps/functions/pg-dump-cron`, `tests/www-e2e` (Playwright), `toolings/`, `infra/railway/`, and `legacy/` — dead code kept for reference, lint-ignored and never imported.

## Commands

```bash
pnpm dev:www          # www + service together (also dev:dash / dev:service / dev)
pnpm build:www        # build:dash / build:service / build
pnpm lint             # oxlint          pnpm format      # oxfmt
pnpm type:check       # tsc --noEmit across the graph
pnpm test             # vitest run      pnpm test:e2e    # playwright
pnpm db:up            # local postgres + redis via docker
pnpm db:generate / db:migrate / db:push / db:seed / db:studio
```

`make init` installs and copies the three `.env.example` files. Scope `lint` and `type:check` to what you touched with `pnpm turbo run <task> --filter <name>...`.

## Conventions

- **Dependency versions live in the pnpm catalogs** in `pnpm-workspace.yaml` (`catalog:`, `catalog:ai`, `catalog:orpc`, …): add the version there and reference the catalog key from the package.json, never a version literal. Internal deps use `workspace:*` (enforced by manypkg).
- **Packages export source, not build output.** `@chia/*` `exports` maps point at `./src/...ts` and the consumer transpiles. One key per module, mirroring its path under `src/` — no root (`.`) entry, and no barrel that only re-exports siblings. The single aggregate is `@chia/db/schema`, which Drizzle and Better Auth need as one namespace. A new entry point means a new `exports` key.
- **Env is validated with `@t3-oss/env-*`**, one `env.ts` per app/package, composed with `extends: [...]`. Add a variable to the owning package's schema, not to a consumer. New global vars go in `turbo.json` `globalEnv`/`globalPassThroughEnv`.
- **Lint and format are oxlint + oxfmt**, not ESLint/Prettier. Husky + lint-staged runs oxfmt on commit.
- **Tests** are Vitest (`__tests__/` or `*.test.ts` beside source), configured per workspace and aggregated by the root `vitest.config.ts`. E2E is Playwright in `tests/www-e2e`.
- **Errors**: throw `AppError` from `@chia/service-kit/errors` in domain code, and convert at the edge with `toORPCError` / `isAppError`.
- **Service URLs** resolve through `withServiceEndpoint` from `@chia/utils/config`, never by hand.
- Branch off and PR into `develop`.
