# `@chia/observability`

OpenTelemetry, structured logging and error reporting shared by the Node servers.

## Boundaries

- A Nitro app sets `hooks: telemetryEntry(...)` and its entry calls `startTelemetry()` before importing `#observability/preset-entry` dynamically. Anything statically imported beside it is linked before the loader hook exists and is not instrumented.
- Server spans and the request log line come from `bootstrap()`. `http.route` stays a route template so metrics keep bounded labels; apps add specifics such as the oRPC procedure (`rpc.method`) as attributes and `requestLogFields`. Incoming `http` instrumentation stays disabled. Ignoring requests with `ignoreIncomingRequestHook` instead suppresses every span under them.
- Long-lived clients (queue runners, LISTEN connections, pools) must start outside a request. Started lazily inside one, their callbacks keep that request's trace forever.
- `pg` and Redis spans require a parent span, so background polling is not exported. Instrumented libraries (`pg`, `@redis/client`) must be traced out of the Nitro bundle and resolve to one version each. A duplicate lands in `node_modules/.nf3/`, where `require-in-the-middle` cannot name it and no spans are recorded.
- `reportError` logs and sends to Sentry; errors carry the active trace id through the OTLP integration. Sentry records no spans and injects no headers.
- Log fields are identifiers, codes and counts. Prompts, drafts, tool output and credentials stay out; `redact` is a backstop, not the filter.
- `"use workflow"` functions run in a sandbox and must not import the logger; steps may.
- `apps/workflow` lists `pino` itself. In `nitro dev` the Workflow step bundler externalizes only packages the app can resolve; a bundled `pino` fails on its CommonJS `require("node:os")`.
- Telemetry is off unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set, and `nitro dev` does not use the build entry. Exporters are configured through the standard `OTEL_*` variables.
- Business records (runs, approvals, usage ledger) stay in the database; telemetry only links to them by ID.
