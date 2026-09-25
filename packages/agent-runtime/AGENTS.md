# `@chia/agent-runtime`

Kind-independent Pi session, turn, tool, compaction and wire-event runtime.

## Boundaries

- Pi is the execution engine; the stable client boundary is `AgentWireEvent`, not an engine-neutral adapter.
- Kinds declare tools with `defineTool` (zod) and prompt text with `prompts`; Pi's types stay inside this package, and `src/pi/` binds them.
- This package owns the durable transcript tree, context projection, approval gate, turn budget and wire event folding.
- Keep prompts, domain tools and kind policies out of the runtime.
- An optional tool parameter is plain zod `.optional()`: the Pi binding offers the model `null` for it and drops that `null` before parsing. `.nullable()` keeps its `null`, for a field where `null` means something.
- `turn`, `compaction`, `maintenance`, `title`, `complete`, `session/*`, `models` and `wire/replay` are server-only. Browser or SSR bundles may import `wire/schema` and `wire/fold`.
- Persist completed entries before emitting their events, and keep replay and live events compatible with the same reducer.
- Turns, tool calls and provider requests are traced with GenAI span names (`invoke_agent`, `execute_tool`, `chat`). Provider requests are traced only on `Models` from `createAgentModels`. Spans carry identifiers, models, usage and outcome, never prompts, outputs or tool arguments.
- Read `docs/agent-architecture.md` before changing lifecycle, persistence or wire contracts.
