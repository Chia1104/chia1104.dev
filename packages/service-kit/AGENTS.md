# `@chia/service-kit`

Shared request context, errors, policies, Hono middleware and transport adapters.

## Boundaries

- `createServiceFactory()` constructs a fresh `ServiceContext` for each request; do not store request state globally.
- Policies are transport-neutral. Bind them to Hono or oRPC through the adapters instead of reimplementing policy in guards.
- `AppError` is the domain error contract; transport adapters convert it at the edge.
- `bootstrap()` owns cross-cutting Hono setup and middleware ordering.
- Route-specific business logic and rate-limit budgets stay in the owning API or app.
