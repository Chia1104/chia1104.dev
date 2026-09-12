# `@chia/test`

Dependency-light Vitest configuration, fixtures and shared test factories.

## Boundaries

- This package must not depend on another `@chia/*` package.
- Keep generic config, environment stubs and data factories here; app-specific helpers stay with their app.
- Mock modules provide reusable values and types, but each consumer owns its `vi.mock` wiring.
- DOM suites add Testing Library cleanup in their setup. Import Vitest APIs explicitly and title tests as behavior sentences.
