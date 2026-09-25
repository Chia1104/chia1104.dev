# `@chia/agent-runtime`

Kind-independent session, turn, tool, compaction and wire-event runtime over TanStack AI.

## Boundaries

- TanStack AI's `chat()` is the execution engine; the stable client boundary is `AgentWireEvent`, not an engine-neutral adapter. Engine types stay inside this package: kinds declare tools with `defineTool` and zod.
- This package owns the durable transcript tree and its message types, context projection, approvals, turn budget, model catalogue binding and wire event folding.
- Keep prompts, domain tools and kind policies out of the runtime.
- An optional tool parameter is a plain zod `.optional()`: strict OpenAI-family adapters offer it as nullable and drop the model's `null` before validation, so `execute` sees `undefined`. Under strict mode the model sends every field, so a field that can be cleared takes an explicit value for that, never `null`.
- Tools are gated by tier alone and gated calls stop the engine; a turn resumes them from its persisted branch with every answer at once. A call reaches the operator only after the turn budget and the kind's preflight pass it and the session does not auto-approve its tier.
- Model-only context (volatile state) goes on the provider request, never into the engine's history or the tree.
- `turn`, `compaction`, `maintenance`, `complete`, `title`, `session/*`, `models` and `wire/replay` are server-only. Browser or SSR bundles may import `wire/schema` and `wire/fold`.
- Persist completed entries before emitting their events, and keep replay and live events compatible with the same reducer.
- Turns, tool calls and provider requests are traced with GenAI span names (`invoke_agent`, `execute_tool`, `chat`). Spans carry identifiers, models, usage and outcome, never prompts, outputs or tool arguments.
- Read `docs/agent-architecture.md` before changing lifecycle, persistence or wire contracts.
