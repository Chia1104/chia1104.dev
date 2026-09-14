# `@chia/observability`

OpenTelemetry setup shared by the Node servers.

## Boundaries

- A Nitro app calls `startTelemetry()` from a custom build entry that then imports the preset entry dynamically. Anything statically imported beside it is linked before the loader hook exists and is not instrumented.
- Instrumented libraries (`pg`, `@redis/client`) must be traced out of the Nitro bundle and resolve to one version each. A duplicate lands in `node_modules/.nf3/`, where `require-in-the-middle` cannot name it and no spans are recorded.
- Telemetry is off unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set, and `nitro dev` does not use the build entry. Exporters are configured through the standard `OTEL_*` variables.
- Business records (runs, approvals, usage ledger) stay in the database; telemetry only links to them by ID.
