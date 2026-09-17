# `@chia/services`

Contract-first oRPC API and the domain services behind it. Third-party clients live in `@chia/integrations`.

## Layout

- `<module>/` owns one oRPC surface: `<module>.contract.ts` for wire contracts, `<module>.route.ts` for handlers and `*.service.ts` for the domain operations behind them. Each contract file ends with `<module>Contract`, each route file with `<module>Router`, and `router.contract.ts` and `router.ts` only compose those objects.
- `shared/` holds what every module needs: `context.ts` (`BaseOSContext`, `baseOS`, `contractOS`), the guards, `rate-limits.ts` and `schema.ts`. A guard used by one module stays in that module.
- Frontends import `@chia/services/router.contract` for the client type and a module's contract file for its schemas.
- `env.ts` is the only env this package parses: where the `service` app is reachable.

## Contracts and transport

- Guards bind transport input to policies from `@chia/service-kit`; do not duplicate authorization logic in handlers.
- Procedure rate-limit budgets belong in `shared/rate-limits.ts`. Mount-level budgets belong to the hosting app.

## Domain boundary

- The oRPC core receives config, workflow control, hooks and agent factories through `BaseOSContext`; `apps/service/src/factories/orpc.factory.ts` is the composition root.
- Handlers use `@chia/db/repos/*`, not raw Drizzle. Domain and policy failures use `AppError`.
- Shared writes live in `*.service.ts` modules and receive lifecycle hooks explicitly. Host apps supply bindings rather than duplicate services.
- A post's content changes only when its draft is applied, through `feeds/draft.service.ts`, which is also what commits a version of the draft. `feeds.update` reaches visibility and dates and nothing a draft owns; there is no route that writes a translation or a body directly. Both start indexing.
- Resource adapters in `rag/` isolate source-specific chunking and hydration. `rag/resource-types.ts` names the types and imports nothing, so `"use workflow"` functions depend on it rather than `rag/registry`. Read `docs/rag-architecture.md` before changing resource indexing or retrieval.
