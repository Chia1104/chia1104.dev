# `@chia/agent-runtime`

Kind-independent Pi session, turn, tool, compaction and wire-event runtime.

## Boundaries

- Pi is the execution engine; the stable client boundary is `AgentWireEvent`, not an engine-neutral adapter.
- This package owns the durable transcript tree, context projection, approval gate, turn budget and wire event folding.
- Keep prompts, domain tools and kind policies out of the runtime.
- `pi/*`, `session/*`, `models` and `wire/replay` are server-only. Browser or SSR bundles may import `wire/schema` and `wire/fold`.
- Persist completed entries before emitting their events, and keep replay and live events compatible with the same reducer.
- Read `docs/agent-architecture.md` before changing lifecycle, persistence or wire contracts.
