# `@chia/agent-elements`

Shared browser-side agent state, queries and chat UI.

## Boundaries

- Keep live state in one Zustand store per session and remote state in TanStack Query.
- Hosts inject the oRPC client, `QueryClient`, localized labels and kind-specific tool renderers; do not import an app.
- `@chia/agent-runtime/wire/schema` is the source of truth for attachments and wire events.
- Host context is separate from session state. A `once` attachment is consumed by the first prompt that carries it.
- Internal-origin links may use the host router; external links require confirmation.
- All `agent-elements` locales must expose identical keys. Host Tailwind sources must include this package and Streamdown's distributed JavaScript.
