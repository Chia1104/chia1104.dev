# `@chia/api`

Contract-first oRPC API, domain orchestration and external service modules.

## Contracts and transport

- Wire contracts live in `orpc/contracts/*.contract.ts`; handlers live in `orpc/routes/*.route.ts`.
- `orpc/router.contract.ts` and `orpc/router.ts` must remain key-for-key identical. Frontends import only `@chia/api/orpc/contracts`.
- Guards bind transport input to policies from `@chia/service-kit`; do not duplicate authorization logic in handlers.
- Procedure rate-limit budgets belong in `orpc/rate-limits.ts`. Mount-level budgets belong to the hosting app.

## Domain boundary

- The oRPC core receives config, workflow control, hooks and agent factories through `BaseOSContext`; `apps/service/src/factories/orpc.factory.ts` is the composition root.
- Handlers use `@chia/db/repos/*`, not raw Drizzle. Domain and policy failures use `AppError`.
- Shared writes live in domain modules and receive lifecycle hooks explicitly. Host apps supply bindings rather than duplicate services.
- Post body edits go through `feeds/draft`; only applying a draft or a feed-level update changes a feed and starts indexing.
- Resource adapters isolate source-specific chunking and hydration. Read `docs/rag-architecture.md` before changing resource indexing or retrieval.
