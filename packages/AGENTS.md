# Packages

Every workspace here is an internal `@chia/*` package. Package-specific boundaries live in the nearest `AGENTS.md`.

## Package map

| Area                   | Packages                                                                                           | Boundary                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| API and infrastructure | `services`, `integrations`, `service-kit`, `db`, `auth`, `kv`, `workflow-control`, `observability` | Contracts, policies, persistence and third-party clients   |
| Agents                 | `agent-runtime`, `agent-host`, `agent-content`, `agent-writing`, `agent-public`, `agent-elements`  | Runtime, host bindings, kinds and client UI                |
| Presentation           | `contents`, `ui`, `themes`, `tailwind`, `shaders`, `i18n`                                          | Content rendering, components, styles and messages         |
| Foundations            | `ai`, `utils`, `meta`, `test`                                                                      | AI providers, shared utilities, site data and test support |

## Shared rules

- Packages export source. Treat `package.json#exports` as the public API: each key maps to one owned module and consumers import that module directly.
- Do not add root or sibling-only barrels. `@chia/db/schema` is the only aggregate export.
- Keep app-specific behavior and deployment configuration in `apps/*`.
- Keep tests beside their owning package. Shared test primitives belong in `@chia/test`.
