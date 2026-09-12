# `@chia/tailwind`

Shared Tailwind CSS preset, animations, color utilities and editor styles.

## Boundaries

- Public CSS entry points are the files declared in `package.json#exports`.
- Keep structural utilities and reusable animation definitions here; semantic application tokens belong in `@chia/themes`.
- Keep app-specific selectors and layout rules in their owning app.
- The icon plugin is build-time support and is not a package runtime API.
