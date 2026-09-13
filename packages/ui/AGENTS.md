# `@chia/ui`

Shared, domain-neutral React components, features, icons and UI utilities.

## Boundaries

- HeroUI is the component library. Where HeroUI has no equivalent, compose `react-aria-components`, its primitive layer, pinned to the version HeroUI resolves; do not add Radix, Base UI or another primitive library.
- Components stay reusable and domain-neutral. App-specific composition, data access and authorization stay in apps.
- Consume semantic tokens from `@chia/themes`; do not create a second token vocabulary in components.
- Preserve server/client conditional exports such as `date-format` and keep browser-only dependencies out of server entries.
- Export components at their implementation module rather than adding barrels.
