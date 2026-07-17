# gateway

Caddy edge gateway for Railway. Routes public traffic to the `auth` and
`service` apps over Railway private networking, and authenticates API requests
at the edge with `forward_auth` against the auth service's
`/auth/internal/gate` endpoint (option C: services trust the injected
`x-ch-auth-session` / `x-ch-auth-api-key` headers instead of re-verifying).

## Routing

| Path               | Upstream | Notes                                                            |
| ------------------ | -------- | ---------------------------------------------------------------- |
| `/auth/internal/*` | —        | blocked (server-to-server only)                                  |
| `/auth/*`          | auth     | better-auth flows                                                |
| `/api/v1/auth/*`   | auth     | legacy path, rewritten to `/auth/*`                              |
| `/api/v1/*`        | service  | `forward_auth` gate (`mode=optional`), identity headers injected |

## Railway setup

Deploy this directory as a Dockerfile service and attach the public domain to
it. `auth` and `service` must NOT have public domains — the injected identity
headers are only trustworthy when the services are reachable exclusively
through this gateway / the private network.

Gateway variables:

```
AUTH_UPSTREAM=${{auth.RAILWAY_PRIVATE_DOMAIN}}:${{auth.PORT}}
SERVICE_UPSTREAM=${{service.RAILWAY_PRIVATE_DOMAIN}}:${{service.PORT}}
INTERNAL_AUTH_SERVICE_TOKEN=${{shared.INTERNAL_AUTH_SERVICE_TOKEN}}
```

`auth` service variables:

```
APP_CODE=auth
AUTH_URL=https://<public-domain>  # the gateway's public origin
INTERNAL_AUTH_SERVICE_TOKEN=${{shared.INTERNAL_AUTH_SERVICE_TOKEN}}
# + AUTH_SECRET, DB/KV, GOOGLE_*/GITHUB_*, RESEND_API_KEY
# (the /auth base path is baked into the app — AUTH_BASE_PATH is not needed)
```

`service` variables (unchanged plus):

```
INTERNAL_AUTH_SERVICE_ENDPOINT=http://${{auth.RAILWAY_PRIVATE_DOMAIN}}:${{auth.PORT}}
INTERNAL_AUTH_SERVICE_TOKEN=${{shared.INTERNAL_AUTH_SERVICE_TOKEN}}
HOST=::                           # Railway private networking is IPv6-only
```

Remember to update the OAuth callback URLs at Google/GitHub from
`/api/v1/auth/callback/*` to `/auth/callback/*` when switching to the
standalone auth service.

## Local development

No Caddy needed — every consumer of the injected identity headers falls back
to calling auth directly when the headers are absent:

- single-process (default): leave `INTERNAL_AUTH_SERVICE_ENDPOINT` unset and
  `service` runs an in-process better-auth at `/api/v1/auth`, exactly as
  before the split.
- two-process: run `apps/auth` (serves `/auth/*` without any extra env) and
  point `service` at it with
  `INTERNAL_AUTH_SERVICE_ENDPOINT=http://localhost:3006` +
  `INTERNAL_AUTH_SERVICE_TOKEN=<any shared value>`.
