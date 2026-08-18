

# Chia1104.dev

[![www deployment](https://img.shields.io/github/deployments/chia1104/chia1104.dev/Production%20%E2%80%93%20chia1104?style=flat-square&logo=vercel&label=www)](https://chia1104.dev)
[![License: MIT](https://img.shields.io/github/license/chia1104/chia1104.dev?style=flat-square)](LICENSE)

The source of [chia1104.dev](https://chia1104.dev): a personal site, the dashboard that manages its content, and the backend service behind both, in one pnpm + Turborepo monorepo. It is also where new stack ideas get tried for real, so the dependencies run ahead of stable.

## What is in here

| App            | Stack                           | Role                                                          |
| -------------- | ------------------------------- | ------------------------------------------------------------- |
| `apps/www`     | Next.js 16, React 19, port 3000 | Public site: profile, blog, projects, contact                 |
| `apps/dash`    | Next.js 16, port 3001           | Admin dashboard: content, assets, RAG index, writing agent    |
| `apps/service` | Hono on Nitro, port 3005        | The only backend: auth, database, durable workflows, AI/agent |

The frontends talk to `service` through a contract-first [oRPC](https://orpc.dev) client; the contract, handlers and guards live in `packages/api`. Auth is [Better Auth](https://better-auth.com), data is Postgres through Drizzle, sessions and caches are in Redis, and long-running work (indexing, agent turns) runs on the [Vercel Workflow SDK](https://github.com/vercel/workflow). Content is MDX rendered with Fumadocs; search is BM25 plus embeddings over ParadeDB.

```
apps/          www, dash, service, gateway (Caddy/Nginx), functions/pg-dump-cron
packages/      @chia/* — api, db, service-kit, auth, kv, ai, agent-runtime, agent-writing,
               agent-content, contents, ui, editor, themes, tailwind, shaders, i18n, meta, utils
tests/www-e2e  Playwright
docs/          architecture notes for the agent and RAG subsystems
infra/railway/ per-service Railway config
```

For how the pieces fit together see [`AGENTS.md`](AGENTS.md), [`apps/AGENTS.md`](apps/AGENTS.md) and [`packages/AGENTS.md`](packages/AGENTS.md).

## Getting started

Requirements: Node >= 22, pnpm 11 (the version is pinned in `package.json`), Docker for the local Postgres and Redis.

```bash
git clone https://github.com/chia1104/chia1104.dev.git
cd chia1104.dev
make init          # pnpm install + copies the three .env.example files
pnpm db:up         # Postgres + Redis in Docker
pnpm db:migrate
pnpm db:seed       # optional
```

Then fill in the `.env` files under `apps/www`, `apps/dash` and `apps/service`.

## Commands

```bash
pnpm dev:www          # www + service      pnpm dev:dash / dev:service / dev (all)
pnpm build:www        # build:dash / build:service / build
pnpm test             # vitest             pnpm test:watch / test:ui / test:e2e
pnpm lint             # oxlint             pnpm lint:fix
pnpm format           # oxfmt
pnpm type:check
pnpm db:generate / db:migrate / db:push / db:studio
```

`make help` lists the same targets.

## Deployment

`www` deploys to Vercel from `apps/www`. `dash` and `service` deploy to Railway from `Dockerfile.dash` and `Dockerfile.node-service`; the per-service settings are in `infra/railway/`. Local containers:

```bash
docker build -f Dockerfile.www -t chia1104-www .
docker build -f Dockerfile.dash -t chia1104-dash .
docker build -f Dockerfile.node-service -t chia1104-service .
```

## License

MIT — see [LICENSE](LICENSE).
