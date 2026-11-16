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
- A procedure in `shared/shared-reads.ts` must answer every caller alike and change nothing. `service` accepts GET only for those and marks a success with the listed `CDN-Cache-Control` and `Access-Control-Allow-Origin: *`; browser links call them as credential-less GETs. The module imports nothing so links can load it.

## Domain boundary

- The oRPC core receives config, workflow control, hooks and agent factories through `BaseOSContext`; `apps/service/src/factories/orpc.factory.ts` is the composition root.
- Handlers use `@chia/db/repos/*`, not raw Drizzle. Domain and policy failures use `AppError`.
- Shared writes live in `*.service.ts` modules and receive lifecycle hooks explicitly. Host apps supply bindings rather than duplicate services.
- A post's content changes only when its draft is applied, through `feeds/draft.service.ts`, which is also what commits a version of the draft. `feeds.update` reaches visibility, dates, the tag set and the one logged work a hobby article is about, and nothing a draft owns; there is no route that writes a translation or a body directly. Both start indexing. `tags/` owns the taxonomy itself; a tag reaches a post only through `feeds.update`.
- A feed's type decides its `FeedMode`: `post` and `note` are the tech site's, `guide`, `review` and `journal` the hobby mode's. `feeds.list` narrows by `mode`, and a tech reader passes it. Tags are one taxonomy shared by both modes, so `tags.list` counts a tag's posts per `mode` and a reader shows only the tags its mode uses. Only tech types are chunked, so site search, related posts and the agents never return a hobby article, and the `public` content-read port lists and reads tech posts only.
- `onFeedChanged` carries a `FeedChangeScope`: `Listing` when what list pages show of the feed differs before and after the write, `Article` otherwise. www invalidates only the article's pages for `Article`, so a write path must compare stored values rather than trust its input.
- `media/` is the owner's log of films, series, anime and games. A row's facts are a snapshot read from a catalogue in `@chia/integrations` (TMDB, AniList, IGDB) when it is created, and its cover and key art are copied into storage, so no reader ever calls a catalogue. A game's play stats are typed by hand, or read from Steam by `media.sync` when the row names a Steam app; the same read replaces the game's `media_achievement` rows, which only `media.get` returns and which link their icons on Steam's CDN instead of copying them. Only `media.list` and `media.get` are public; every write ends in `workflow.startSiteRevalidation(WwwCacheTag.Media)`.
- `reports/` is the operator's side of reader reports; every route is operator-only. A suggested edit reaches a post only through its draft, and applying a draft resolves that post's in-progress reports in the apply transaction.
- A translation's `summary` and `read_time` are workflow-owned: the draft never carries them and an apply leaves them alone. `feeds.summarize` starts the summarize workflow on a published post; `feeds.summarize:run` reads the run back until it settles.
- Resource adapters in `rag/` isolate source-specific chunking and hydration. `rag/resource-types.ts` names the types and imports nothing, so `"use workflow"` functions depend on it rather than `rag/registry`. Read `docs/rag-architecture.md` before changing resource indexing or retrieval.
