# `@chia/agent-runtime`

Kind-independent Pi session, turn, tool, compaction and wire-event runtime.

## Boundaries

- Pi is the execution engine; the stable client boundary is `AgentWireEvent`, not an engine-neutral adapter.
- This package owns the durable transcript tree, context projection, approval gate, turn budget and wire event folding.
- Keep prompts, domain tools and kind policies out of the runtime.
- An optional tool parameter goes through `optional` from `tools`, which offers the model `null` and drops it before `execute`. A hand-written `Type.Union([..., Type.Null()])` is for a field where `null` means something, such as clearing it.
- `pi/*`, `session/*`, `models` and `wire/replay` are server-only. Browser or SSR bundles may import `wire/schema` and `wire/fold`.
- Persist completed entries before emitting their events, and keep replay and live events compatible with the same reducer.
- Turns, tool calls and provider requests are traced with GenAI span names (`invoke_agent`, `execute_tool`, `chat`). Provider requests are traced only on `Models` from `createAgentModels`. Spans carry identifiers, models, usage and outcome, never prompts, outputs or tool arguments.
- Read `docs/agent-architecture.md` before changing lifecycle, persistence or wire contracts.
