# `@chia/agent-writing`

The operator-only writing agent's prompts, policies, tools, ports, draft state and memory behavior.

## Boundaries

- Keep writing-specific behavior here; the generic turn lifecycle belongs in `@chia/agent-runtime` and host bindings in `@chia/agent-host`.
- Mutable effects must cross explicit draft, memory, content or web ports and retain their approval policy.
- A connector is a port under `WritingToolContext.connectors`, a `<name>_*` tool group and its scope in `config.ts`. The port is required, not optional, and the host enforces the operator's scope; tools never hold a credential.
- A writing session is not bound to one draft. Draft context is admitted through attachments and shared draft state.
- Feed content changes only through the draft commit/apply boundary. Applying is the commit and acts on the content hash the operator approved; preserve revision checks when writing shared drafts.
- The MDX component guidance in `prompts/skills.ts` must change with `@chia/contents/mdx-components`.
