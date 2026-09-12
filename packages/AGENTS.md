# Packages

Every workspace here is an internal `@chia/*` package. Package-specific boundaries live in the nearest `AGENTS.md`.

## Package map

| Area                   | Packages                                                                                          | Boundary                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| API and infrastructure | `api`, `service-kit`, `db`, `auth`, `kv`, `workflow-control`                                      | Contracts, policies, persistence and service integration   |
| Agents                 | `agent-runtime`, `agent-host`, `agent-content`, `agent-writing`, `agent-public`, `agent-elements` | Runtime, host bindings, kinds and client UI                |
| Presentation           | `contents`, `ui`, `themes`, `tailwind`, `shaders`, `i18n`                                         | Content rendering, components, styles and messages         |
| Foundations            | `ai`, `utils`, `meta`, `test`                                                                     | AI providers, shared utilities, site data and test support |

## Shared rules

- Internal dependencies use `workspace:*`; third-party versions come from the appropriate catalog in `pnpm-workspace.yaml`.
- Packages export source. Treat `package.json#exports` as the public API: each key maps to one owned module and consumers import that module directly.
- Do not add root or sibling-only barrels. `@chia/db/schema` is the only aggregate export.
- Do not rename or re-export another package's symbols locally. Wrap only when adding behavior.
- Keep app-specific behavior and deployment configuration in `apps/*`.
- Keep tests beside their owning package. Shared test primitives belong in `@chia/test`, which must not depend on another `@chia/*` package.
- Update the local `AGENTS.md` only when a package boundary or invariant changes.

Read `docs/agent-architecture.md` before changing agent packages and `docs/rag-architecture.md` before changing indexing or retrieval.
