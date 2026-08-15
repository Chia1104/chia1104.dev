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

Three deployables: `apps/www` (public site, Next.js, Vercel), `apps/dash` (admin dashboard, Next.js, Railway) and `apps/service` (the only backend — Hono on Nitro, Railway; owns auth, DB, workflows, the AI/agent runtime). Both frontends talk to `service` through a contract-first oRPC client.

## Where the details live

- [`apps/AGENTS.md`](apps/AGENTS.md) — each app, the deployment split, how the frontends reach `service`, the service surface and its internal layout.
- [`packages/AGENTS.md`](packages/AGENTS.md) — the API architecture (contracts, guards and policies, context injection, data access, errors) and a guide to every shared package.
- [`docs/agent-architecture.md`](docs/agent-architecture.md) and [`docs/rag-architecture.md`](docs/rag-architecture.md) — read before touching the agent or RAG subsystems; both have non-obvious invariants (durable workflow turns, approval handshake, chunk/embedding versioning).

## Layout

```
apps/          www, dash, service (+ gateway, functions/pg-dump-cron, env-only placeholders)
packages/      @chia/* — api, db, service-kit, auth, kv, ai, agent-runtime, agent-writing,
               contents, ui, editor, themes, tailwind, shaders, i18n, meta, utils
tests/www-e2e  Playwright
toolings/      shared scripts
docs/          architecture deep dives
infra/railway/ per-service railway.json
legacy/        dead code kept for reference — lint-ignored, never imported
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

`make help` lists the same targets. `make init` installs and copies the three `.env.example` files.

Filter a single workspace with `pnpm turbo run <task> --filter <name>...`. Prefer running `lint`/`type:check` scoped to what you touched.

## Conventions

- **Dependency versions live in the pnpm catalogs** in `pnpm-workspace.yaml` (`catalog:`, `catalog:ai`, `catalog:orpc`, …). Add a version there and reference the catalog — never pin a version inline in a package.json. Internal packages use `workspace:*` (enforced by manypkg).
- **Package exports are source, not build output.** `@chia/*` packages export `./src/...ts` directly and are transpiled by the consumer. Adding a new entry point means adding it to that package's `exports` map.
- **Env is validated with `@t3-oss/env-*`**, one `env.ts` per app/package, composed with `extends: [...]`. Add a variable to the owning package's schema, not to a consumer. Turbo needs new global vars listed in `turbo.json` `globalEnv`/`globalPassThroughEnv`.
- **Lint/format is oxlint + oxfmt**, not ESLint/Prettier. Husky + lint-staged runs oxfmt on commit.
- **Tests** are Vitest (`__tests__/` or `*.test.ts` beside source), configured per workspace and aggregated by the root `vitest.config.ts`. E2E is Playwright in `tests/www-e2e`.
- **Errors**: throw `AppError` from `@chia/service-kit/errors` in domain code, convert at the edge with `toORPCError` / `isAppError`.
- **Endpoints**: never hand-build a service URL — go through `withServiceEndpoint` from `@chia/utils/config`.
- Branch off and PR into `develop`.
