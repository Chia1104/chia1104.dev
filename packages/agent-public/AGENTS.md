# `@chia/agent-public`

The public site's reader agent kind.

## Boundaries

- This package owns the public prompt, model policy, runtime configuration and tool set.
- The public kind reads published content through the shared content-read tools. The host may grant two more capabilities per turn: `WebPort` (config on, guard configured, signed-in owner) and `ReportPort` (signed-in owner). Do not add draft, memory, approval or any other write capability.
- `report_issue` writes a report row the operator reviews; it never changes content the visitor reads.
- Keep its minimum access tier at `Guest`; callers without their own provider key use the configured default model.
- Do not inject the configured author's write identity or a write-capable content port.
