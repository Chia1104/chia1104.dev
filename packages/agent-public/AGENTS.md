# `@chia/agent-public`

The public site's read-only reader agent kind.

## Boundaries

- This package owns the public prompt, model policy, runtime configuration and tool set.
- The public kind may use shared content-read tools only. Do not add draft, memory, web, approval or write capabilities.
- Keep its minimum access tier at `Guest`; callers without their own provider key use the configured default model.
- Do not inject the configured author's write identity or a write-capable port.
