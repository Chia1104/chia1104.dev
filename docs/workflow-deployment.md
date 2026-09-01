# Workflow deployment

`apps/workflow` is the only durable-workflow executor and runs one replica. `apps/service` may scale independently.

## 1. Topology

```text
dash / www
    │
    ▼
apps/service (N replicas)
    │  WorkflowControl over private HTTP
    ▼
apps/workflow (1 replica)
    ├─ /.well-known/workflow/*   Workflow SDK executor
    ├─ /                         authenticated control commands
    ├─ /health
    └─ workflows and steps
             │
             ▼
shared PostgreSQL
    ├─ application tables
    ├─ workflow event log
    └─ Graphile jobs
```

Both processes create the SDK World against the same storage, but only `apps/workflow` starts its Graphile runner.

| Operation                                | `apps/service`                                 | `apps/workflow`                                 |
| ---------------------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| Start, hook resume, cancel               | Sends authenticated `WorkflowControl` commands | Executes through `workflow/api`                 |
| Run status, hook readiness, stream reads | Reads shared World directly                    | Reads shared World directly                     |
| Runner, startup recovery, shutdown       | Never owns them                                | Starts and closes them through the Nitro plugin |

Creating a World in `service` is safe because reads use only its storage and streamer. Every queue mutation crosses `@chia/workflow-control/contract` to the workflow process.

## 2. Network and configuration

`service` resolves `apps/workflow` with `withServiceEndpoint("/", Service.Workflow, { isInternal: true })`. Railway uses `INTERNAL_WORKFLOW_SERVICE_ENDPOINT`; there is no public or `NEXT_PUBLIC_*` endpoint. Do not expose workflow ingress publicly.

Both apps must agree on:

```dotenv
WORKFLOW_TARGET_WORLD=@workflow/world-postgres
WORKFLOW_POSTGRES_URL=...
WORKFLOW_POSTGRES_JOB_PREFIX=...
WORKFLOW_QUEUE_NAMESPACE=... # when set
INTERNAL_WORKFLOW_SERVICE_TOKEN=<same value, at least 32 random characters>
```

`apps/workflow` also owns worker settings:

```dotenv
WORKFLOW_POSTGRES_WORKER_CONCURRENCY=10
WORKFLOW_POSTGRES_MAX_POOL_SIZE=12
```

Steps receive their database, provider and service credentials through `apps/workflow/.env.example`.

## 3. Why the runner is single-replica

The installed `@workflow/world-postgres` adapter has process-local coordination:

1. `world.start()` re-enqueues open runs without a cross-process idempotency key. Hook-waiting agent sessions still count as running.
2. Replay and message deduplication live in memory. Graphile prevents duplicate claims of one job row, not duplicate jobs for one run.
3. `runAgentTurnStep` is not replay-safe and has `maxRetries = 0`; no database claim protects a step across processes.

Running two workflow replicas can therefore execute the same run or side effect twice.

Multi-replica support requires, in order:

1. Producer and consumer separation.
2. Leader-only startup recovery with stable idempotency identities.
3. Postgres leases with fencing for replay and step execution.
4. Idempotency keys or an outbox for external side effects.

## 4. Deployment and shutdown

- Keep `numReplicas: 1` in `infra/railway/workflow.json`. Brief overlap during deployment is tolerated; steady-state overlap is not.
- When migrating from an embedded runner, first deploy `service` without `workflow/nitro`, then start `apps/workflow`. The event log and queued jobs remain in Postgres during the gap.
- The Nitro plugin calls `world.start()` and closes the World on the Nitro `close` hook. Give the container enough termination grace for in-flight steps.
- Worker concurrency is per process. Keep the workflow pool at least `concurrency + 2`, and include it in the database connection budget.

## 5. Local development

`pnpm dev:service`, `dev:www` and `dev:dash` start `apps/workflow` on port 3008 beside `service`. `make init` copies compatible local environment files and the shared control token.
