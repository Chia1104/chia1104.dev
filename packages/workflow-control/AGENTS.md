# `@chia/workflow-control`

Typed control boundary used by `service` to start, resume and cancel work in `workflow`.

## Boundaries

- `control.contract.ts` defines the wire contract; `client.ts` implements the authenticated caller and hooks expose shared agent control types.
- Keep workflow execution, step code and domain orchestration out of this package.
- Migrate the service caller and workflow handler together when the contract changes; do not add compatibility paths.
- Keep the contract transport-focused and free of app implementation types.
