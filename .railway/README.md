# Railway configuration

This repository manages the `beta` and `production` Railway environments with
`.railway/railway.ts`. Link the target environment before planning or applying.

```bash
railway link --project chia1104.dev --environment beta
railway config plan
railway config apply
```

Repeat the commands with `--environment production` to manage production. Each
plan and apply affects only the linked environment.

Before the first production apply, clear the Railway Config File settings for
`dash` and `service`. Their legacy `infra/railway/*.json` files otherwise remain
an active deployment override.

Always review the plan before applying it. Do not apply a plan that deletes a
service, variable, or volume unless that deletion is intentional. Existing
Railway-managed secret values use `preserve()` and are never stored in source.
