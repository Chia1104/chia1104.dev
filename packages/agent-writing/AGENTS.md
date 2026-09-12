# `@chia/agent-writing`

The operator-only writing agent's prompts, policies, tools, ports, draft state and memory behavior.

## Boundaries

- Keep writing-specific behavior here; generic Pi lifecycle belongs in `@chia/agent-runtime` and host bindings in `@chia/agent-host`.
- Mutable effects must cross explicit draft, memory, content or web ports and retain their approval policy.
- A writing session is not bound to one draft. Draft context is admitted through attachments and shared draft state.
- Feed content changes only through the draft commit/apply boundary; preserve revision checks when writing shared drafts.
- The MDX component guidance in `prompts/skills.ts` must change with `@chia/contents/mdx-components`.
