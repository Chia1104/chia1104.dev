# `@chia/auth`

Session tokens, OAuth providers, API-key material, caller grading and the browser auth client.

## Boundaries

- `CallerTier` and caller grading are defined here. Root is the configured admin's id; no column on the user row grants it. `session.access` is a frontend projection and must not be trusted by server guards.
- API-key scopes are part of authorization. `operator:root` elevates only a key owned by the configured administrator.
- Session tokens and API keys are stored only as SHA-256 hashes; the raw value exists only in the cookie or with the key's holder.
- OAuth redirect URIs are built on `AUTH_URL`, never on the request host. A sign-in returns only to an origin in `CORS_ALLOWED_ORIGIN`, and a provider identity signs in only with a verified email.
- `client.ts` is the only browser module and holds no secrets; never move server configuration into it.
