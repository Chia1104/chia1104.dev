# Workflow deployment

`apps/workflow` is the only process that executes durable workflows. `apps/service` scales out;
`apps/workflow` runs exactly one replica.

```text
dash / www
    │
    ▼
apps/service (N replicas)
    │  POST /api/v1/internal/workflow  (bearer INTERNAL_WORKFLOW_SERVICE_TOKEN)
    ▼
apps/workflow (1 replica)
    ├─ /.well-known/workflow/*       Workflow SDK executor routes
    ├─ /api/v1/internal/workflow     WorkflowControl commands
    ├─ workflows / steps             agent session, indexing, memory consolidation
    └─ Postgres World + Graphile runner
             │
             ▼
       shared PostgreSQL (application tables + workflow event log + graphile jobs)
```

## Who does what

| Concern                                    | `apps/service`                   | `apps/workflow`               |
| ------------------------------------------ | -------------------------------- | ----------------------------- |
| Workflow start, hook resume, run cancel    | `WorkflowControl` client → HTTP  | executes via `workflow/api`   |
| Run status, hook readiness, stream reads   | direct, through the shared World | direct                        |
| Graphile runner, startup recovery, `close` | never                            | Nitro plugin, one per process |

`service` still creates the SDK World (`getWorld()`) because `getRun`, `getHookByToken` and
`getReadable` go through the World's storage and streamer. That is safe: only `queue()` starts the
embedded Graphile runner, and the API process never calls it. Every queue mutation goes through
`@chia/workflow-control/contract` to `apps/workflow`, so no API replica ever owns a runner.

## Environment

Both apps read the same World storage and must agree on `WORKFLOW_TARGET_WORLD`,
`WORKFLOW_POSTGRES_URL`, `WORKFLOW_POSTGRES_JOB_PREFIX` and, when set, `WORKFLOW_QUEUE_NAMESPACE`.

`apps/service`:

```dotenv
WORKFLOW_TARGET_WORLD=@workflow/world-postgres
WORKFLOW_POSTGRES_URL=...
INTERNAL_WORKFLOW_SERVICE_ENDPOINT=http://<workflow private host>:8080
INTERNAL_WORKFLOW_SERVICE_TOKEN=<at least 32 random characters>
```

`apps/workflow`:

```dotenv
WORKFLOW_TARGET_WORLD=@workflow/world-postgres
WORKFLOW_POSTGRES_URL=...
WORKFLOW_POSTGRES_WORKER_CONCURRENCY=10
WORKFLOW_POSTGRES_MAX_POOL_SIZE=12
INTERNAL_WORKFLOW_SERVICE_TOKEN=<same token>
```

plus the database, admin id, provider keys and `FIRECRAWL_API_KEY` the steps need (`.env.example`).
The control endpoint is private; never route public ingress to `apps/workflow`.

## Why one replica

The installed `@workflow/world-postgres` adapter is process-local in three places, so two runners
against the same database duplicate work:

1. `world.start()` re-enqueues every `pending`/`running` run without an idempotency key, and an
   agent session parked on a hook is `running`. Each runner boot replays every open session.
2. Its replay/message deduplication (`completedMessages`, `inflightMessages`,
   `inflightWorkflowRuns`) is in memory; Graphile only prevents two workers claiming one job row,
   not two jobs for the same run.
3. `runAgentTurnStep` is not replay-safe (`maxRetries = 0`), and nothing claims a step across
   processes.

Scaling `apps/workflow` past one replica needs, in this order: producer/consumer separation,
leader-only startup recovery with a stable idempotency identity, a Postgres claim with lease and
fencing per replay and step, and idempotency keys or an outbox for external side effects.

## Rollout

- Keep `numReplicas: 1` (`infra/railway/workflow.json`). A redeploy briefly overlaps old and new
  instances; that is tolerable for a few seconds, a deliberate second replica is not.
- The first cutover from the embedded runner in `service` must not overlap: deploy the `service`
  build without `workflow/nitro` first, then start `apps/workflow`. Jobs and the event log stay in
  Postgres, so the pause loses nothing.
- The Nitro plugin starts the SDK's singleton World and calls `world.close()` on the Nitro `close`
  hook; give the container enough termination grace for in-flight steps.
- `WORKFLOW_POSTGRES_WORKER_CONCURRENCY` is per process. Size `WORKFLOW_POSTGRES_MAX_POOL_SIZE` to
  at least `concurrency + 2` and count it against the database connection budget together with
  the application pool.

## Local development

`pnpm dev:service` / `dev:www` / `dev:dash` start `apps/workflow` (port 3008) next to `service`;
`make init` copies both `.env.example` files, which already share a local token.
