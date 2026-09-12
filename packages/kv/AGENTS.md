# `@chia/kv`

Shared Keyv adapters, cache providers, Drizzle caching and Upstash rate limiting.

## Boundaries

- Keep Redis, Valkey and Postgres behavior behind the exported adapter and provider interfaces.
- `env.ts` owns KV backend configuration; consumers must not read KV credentials directly.
- Cache and rate-limit primitives remain domain-neutral. Budgets and authorization policy belong to their owning API or app.
- Consumers choose caching explicitly; do not make database caching an implicit global behavior.
