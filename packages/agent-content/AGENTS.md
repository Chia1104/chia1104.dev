# `@chia/agent-content`

Shared read-only content capabilities for every agent kind.

## Boundaries

- `ContentReadPort` and `ProfileReadPort` are the host seams for content and profile access.
- Tools in this package may search or read content; they must not expose draft, memory or other write capabilities.
- Keep tool definitions, registries and result summaries kind-independent. Kind-specific prompts and policies belong in the kind package.
- Host-specific adapters and identities are supplied by the hosting app or API layer.
