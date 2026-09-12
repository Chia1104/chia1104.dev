# `@chia/integrations`

Clients for third-party services: GitHub, Spotify, Better Stack, captcha providers, Resend and S3.

- One directory per provider. Each parses its own env with `@t3-oss/env-core` and exports only what a caller needs.
- Nothing here knows about oRPC, the database or the session. Domain code in `@chia/services` calls these clients; they never call back.
- Keep heavy SDKs behind dynamic imports where a module is imported on a boot path that rarely uses them.
