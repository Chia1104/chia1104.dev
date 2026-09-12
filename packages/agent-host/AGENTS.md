# `@chia/agent-host`

Shared host bindings used by `service` and `workflow` to load and run agent kinds.

## Boundaries

- This package owns kind resolution, host configuration, credentials, quota, task and usage bindings.
- Generic session and run orchestration stays in `@chia/api`; prompts, tools and policies stay in each agent-kind package.
- Keep app adapters thin and keep app imports out of this package.
- Load kind implementations and heavy provider dependencies dynamically where the host boot path would otherwise import them eagerly.
