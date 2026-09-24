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
- `AGENTS.md` records boundaries and invariants. Update it when a seam changes, not when a feature ships. Do not add walkthroughs, procedure catalogs, UI placement or implementation history.

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
- Import a symbol at the call site. Do not rename or re-export it through a local wrapper; wrap only when adding behavior.
- Validate env with one `@t3-oss/env-*` `env.ts` per app or package. Variables belong to their owner; global variables also belong in `turbo.json`.
- Use oxlint, oxfmt and Vitest. End-to-end tests live in `tests/www-e2e` and use Playwright.
- An enum is a PascalCase const object with PascalCase keys plus a same-named type, `export type Foo = (typeof Foo)[keyof typeof Foo]`; no TS `enum`, bare string-literal unions or `as const` arrays. Schemas derive from it (`z.enum(Foo)`) and untyped input narrows with `isEnumValue` from `@chia/utils/is`.
- A type assertion needs a `SAFETY:` comment; prefer narrowing, `satisfies` or a parser at the boundary so the assertion is not needed.
- Domain code throws `AppError`; transport edges convert it with `toORPCError` or `isAppError`.
- Server code logs through `@chia/observability/logger`. The boundary that handles a failure this system caused calls `reportError` once; caller failures are logged at most.
- Resolve service URLs with `withServiceEndpoint` from `@chia/utils/config`.
- Scope validation to affected workspaces with `pnpm turbo run <task> --filter <name>...` when practical.
- CI selects work from Turbo's dependency graph with `--affected`; do not add path filters or per-app workflows. A workspace with a `Dockerfile` gets an image build, except `www`, which deploys on Vercel.
- Branch from and open pull requests into `develop`.
