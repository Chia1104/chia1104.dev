# `@chia/ui`

Shared, domain-neutral React components, features, icons and UI utilities.

## Boundaries

- HeroUI is the primary component library. Keep Radix or shadcn primitives only where HeroUI has no equivalent; do not add parallel primitives.
- Components stay reusable and domain-neutral. App-specific composition, data access and authorization stay in apps.
- Consume semantic tokens from `@chia/themes`; do not create a second token vocabulary in components.
- Preserve server/client conditional exports such as `date-format` and keep browser-only dependencies out of server entries.
- Export components at their implementation module rather than adding barrels.
