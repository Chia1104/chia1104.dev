# `@chia/contents`

Shared MDX content rendering, component mapping and content-facing React services.

## Boundaries

- `mdx-components` is the canonical list of components allowed in post MDX.
- Update the writing agent's MDX component guidance in the same change when this list changes.
- Keep server-only loading in the RSC entry and browser behavior in client-safe entries.
- Keep app layout, routing and authorization outside this package.
