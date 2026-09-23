# `@chia/workflow-control`

Typed control boundary used by `service` to start, resume and cancel work in `workflow`.

## Boundaries

- `control.contract.ts` defines the wire contract; `client.ts` implements the authenticated caller; `agent.schema.ts` holds the agent payload schemas and `agent.hooks.ts` the hook built on them.
- `contract` and `agent-schema` reach the browser through the oRPC contracts, so they import zod and other schemas only, never the workflow SDK.
- Keep workflow execution, step code and domain orchestration out of this package.
- Migrate the service caller and workflow handler together when the contract changes; do not add compatibility paths.
- Keep the contract transport-focused and free of app implementation types.
