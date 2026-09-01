# Chia1104.dev

Personal site and architecture playground built as a pnpm + Turborepo monorepo. It has one maintainer, one deployment per app and no external consumers of internal APIs.

## Engineering principles

- Delete obsolete paths. Migrate both sides of an internal contract together; do not add compatibility layers, fallbacks or migration shims.
- Ship the smallest end-to-end change that works. Avoid speculative abstraction, configuration and indirection.
- Put extension seams at contracts, policies, ports and repositories, not unused flags or plugin systems.
- Use the current stack as designed. Check dependency docs and types before downgrading, replacing or routing around an API.
- Prefer existing dependencies over custom code or new packages.
- Choose the long-term design; do not land stopgaps intended for later replacement.
- Comments explain constraints and invariants, not implementation history. One sentence for what the symbol does; a second only when the code cannot show why. If the name is enough, write nothing. Do not restate identifiers, narrate migrations or decorate files with section banners. Keep `SAFETY`, `@deprecated`, `@default` and `@example`.

## Architecture

| App             | Role                                              | Runtime                                |
| --------------- | ------------------------------------------------- | -------------------------------------- |
| `apps/www`      | Public site                                       | Next.js on Vercel                      |
| `apps/dash`     | Admin dashboard                                   | Next.js on Railway                     |
| `apps/service`  | Auth, database access, AI routes and the oRPC API | Hono on Nitro, Railway                 |
| `apps/workflow` | Durable workflows and agent turn execution        | Hono on Nitro, Railway; single replica |

Both frontends call `service` through the contract-first oRPC client. `service` controls `workflow` through `@chia/workflow-control`.

- [`apps/AGENTS.md`](apps/AGENTS.md) defines deployment and app boundaries.
- [`packages/AGENTS.md`](packages/AGENTS.md) defines package and API boundaries.
- Read [`docs/agent-architecture.md`](docs/agent-architecture.md) before changing agents and [`docs/rag-architecture.md`](docs/rag-architecture.md) before changing RAG.
- `legacy/` is reference-only and must never be imported.

## Repository rules

- Put dependency versions in the appropriate catalog in `pnpm-workspace.yaml`; package manifests reference catalog keys. Internal dependencies use `workspace:*`.
- `@chia/*` packages export source. Each `exports` key mirrors one module under `src/`; do not add a root export or sibling-only barrel. `@chia/db/schema` is the only aggregate export.
- Validate env with one `@t3-oss/env-*` `env.ts` per app or package. Variables belong to their owner; global variables also belong in `turbo.json`.
- Use oxlint, oxfmt and Vitest. End-to-end tests live in `tests/www-e2e` and use Playwright.
- Domain code throws `AppError`; transport edges convert it with `toORPCError` or `isAppError`.
- Resolve service URLs with `withServiceEndpoint` from `@chia/utils/config`.
- Scope validation to affected workspaces with `pnpm turbo run <task> --filter <name>...` when practical.
- Branch from and open pull requests into `develop`.
