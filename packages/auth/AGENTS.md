# `@chia/auth`

Better Auth configuration, API-key semantics and server/browser auth clients.

## Boundaries

- `CallerTier` and caller grading are defined here. `session.access` is a frontend projection and must not be trusted by server guards.
- API-key scopes are part of authorization. `operator:root` elevates only a key owned by the configured administrator.
- Keep server-only configuration and browser clients on their existing conditional exports; never move secrets into client modules.
- Keep email providers and templates lazily imported.
- Change Better Auth configuration, plugins and generated `auth-schema.ts` together when the persisted schema changes.
