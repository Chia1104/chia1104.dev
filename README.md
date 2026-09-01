# Chia1104.dev

[![www deployment](https://img.shields.io/github/deployments/chia1104/chia1104.dev/Production%20%E2%80%93%20chia1104?style=flat-square&logo=vercel&label=www)](https://chia1104.dev)
[![License: MIT](https://img.shields.io/github/license/chia1104/chia1104.dev?style=flat-square)](LICENSE)

The source of [chia1104.dev](https://chia1104.dev): a personal site, its admin dashboard and the services behind them. It is a pnpm + Turborepo monorepo where new stack and architecture ideas are tried in production.

## Architecture

| App             | Stack and deployment              | Responsibility                                                   |
| --------------- | --------------------------------- | ---------------------------------------------------------------- |
| `apps/www`      | Next.js 16 on Vercel, port 3000   | Public profile, blog, projects, search and reading agent         |
| `apps/dash`     | Next.js 16 on Railway, port 3001  | Content administration, assets, writing agent and RAG operations |
| `apps/service`  | Hono on Nitro, Railway, port 3005 | Auth, database access, oRPC and AI HTTP routes                   |
| `apps/workflow` | Hono on Nitro, Railway, port 3008 | Durable workflows, indexing jobs and agent turns; one replica    |

Both frontends call `service` through a contract-first [oRPC](https://orpc.dev) client. `service` sends durable work to `workflow` through `@chia/workflow-control`; both read the same PostgreSQL-backed Workflow World.

The main infrastructure is [Better Auth](https://better-auth.com), Postgres with Drizzle, Redis through Keyv, the [Vercel Workflow SDK](https://github.com/vercel/workflow), and ParadeDB for BM25 plus vector retrieval. Content is authored as MDX and rendered with Fumadocs.

## Back-office AI features

### Writing agent

The dashboard includes a multi-session writing workspace. The agent can read existing posts, search and fetch web sources, keep long-term memory, prepare locale-specific drafts and commit approved changes to live content. Sessions support streaming, abort, compaction, rewind and forks; commit-tier tools pass through the approval policy before writing live content.

The administration pages also provide:

- Agent-kind defaults and instructions.
- Model, prompt and parameter overrides for title, compaction, branch-summary and lesson-extraction tasks.
- Weekly house-spend and concurrent-turn limits for visitors.
- Memory review for fetched sources, saved facts and learned writing preferences, including approval of pending lessons and manual session consolidation.

The public site has a separate read-only agent with published-content access and a smaller model and tool budget.

See [Agent architecture](docs/agent-architecture.md) or the [中文版本](docs/agent-architecture.zh.md).

### RAG management

The RAG dashboard manages the shared chunk and embedding index used by search and agent memory:

- Overview of the active model and index version, embedding coverage, stale or missing vectors, and breakdowns by source, locale, chunk kind and visibility.
- Chunk explorer with content, embedding-state, kind and locale filters, plus per-chunk details.
- Index-run history with target, progress, failures and duration.
- Maintenance actions to embed missing chunks, run a full reindex and prune stale vectors.

See [RAG architecture](docs/rag-architecture.md) or the [中文版本](docs/rag-architecture.zh.md).

## Repository layout

```text
apps/          deployable applications and scheduled functions
packages/      source-exported @chia/* packages
tests/         Playwright end-to-end tests
docs/          current agent, RAG and workflow architecture
toolings/      shared configuration, scripts and generators
infra/railway/ Railway service configuration
legacy/        reference-only code; never imported
```

Development rules and package boundaries live in [`AGENTS.md`](AGENTS.md), [`apps/AGENTS.md`](apps/AGENTS.md) and [`packages/AGENTS.md`](packages/AGENTS.md).

## Getting started

Requirements: Node.js 22 or newer, pnpm 12.1.0 and Docker. Pkl 0.25.2 or newer is needed only when regenerating site metadata.

```bash
git clone https://github.com/chia1104/chia1104.dev.git
cd chia1104.dev
make init
pnpm db:up
pnpm db:migrate
pnpm db:seed # optional
```

`make init` installs dependencies and copies `.env.example` to `.env` for `www`, `dash`, `service` and `workflow`. Fill in the required values before starting the apps.

## Commands

```bash
pnpm dev:www          # www + service + workflow
pnpm dev:dash         # dash + service + workflow
pnpm dev:service      # service + workflow
pnpm dev              # all workspaces

pnpm build            # build all workspaces
pnpm build:www        # or build:dash, build:service, build:workflow
pnpm lint
pnpm format
pnpm type:check
pnpm test
pnpm test:e2e

pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:studio
```

`make help` lists equivalent setup, development, validation, database and Docker targets.

## Deployment

`www` deploys to Vercel. `dash`, `service` and the single-replica `workflow` deploy to Railway; their settings live in `infra/railway/`. Run `make docker-build` to build all local images or use the per-app Docker targets listed by `make help`.

The workflow runner must remain single-replica until it has cross-process replay and step claims. See [Workflow deployment](docs/workflow-deployment.md).

## License

MIT. See [LICENSE](LICENSE).
