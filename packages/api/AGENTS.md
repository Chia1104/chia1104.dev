# `@chia/api`

Contract-first oRPC API, domain orchestration and external service modules.

## Layout

- `services/<module>/` owns one oRPC surface: `<module>.contract.ts` for wire contracts, `<module>.route.ts` for handlers and `*.service.ts` for the domain operations behind them. Each contract file ends with `<module>Contract`, each route file with `<module>Router`, and `services/router.contract.ts` and `services/router.ts` only compose those objects.
- `services/shared/` holds what every module needs: `context.ts` (`BaseOSContext`, `baseOS`, `contractOS`), the guards, `rate-limits.ts` and `schema.ts`. A guard used by one module stays in that module.
- Frontends import `@chia/api/services/router.contract` for the client type and a module's contract file for its schemas.
- `github/`, `spotify/`, `betterstack/`, `captcha/`, `email/` and `s3/` are external service clients and parse their own env.

## Contracts and transport

- Guards bind transport input to policies from `@chia/service-kit`; do not duplicate authorization logic in handlers.
- Procedure rate-limit budgets belong in `services/shared/rate-limits.ts`. Mount-level budgets belong to the hosting app.

## Domain boundary

- The oRPC core receives config, workflow control, hooks and agent factories through `BaseOSContext`; `apps/service/src/factories/orpc.factory.ts` is the composition root.
- Handlers use `@chia/db/repos/*`, not raw Drizzle. Domain and policy failures use `AppError`.
- Shared writes live in `*.service.ts` modules and receive lifecycle hooks explicitly. Host apps supply bindings rather than duplicate services.
- Post body edits go through `services/feeds/draft.service.ts`; only applying a draft or a feed-level update changes a feed and starts indexing.
- Resource adapters in `services/rag/` isolate source-specific chunking and hydration. Read `docs/rag-architecture.md` before changing resource indexing or retrieval.
