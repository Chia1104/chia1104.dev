# Packages

Every package is `@chia/<name>`, references siblings with `workspace:*` and exports source. Treat each package's `exports` map as its public module list.

## API architecture

The API spans three packages:

| Package       | Responsibility                                                           |
| ------------- | ------------------------------------------------------------------------ |
| `api`         | oRPC contracts, handlers and guards; domain orchestration and host ports |
| `service-kit` | Request context, policies, errors, middleware and transport adapters     |
| `db`          | Drizzle schemas and repositories                                         |

### Contracts

Wire contracts live in `api/orpc/contracts/*.contract.ts`; handlers live in `api/orpc/routes/*.route.ts`. `router.contract.ts` and `router.ts` compose them and must remain key-for-key identical. Consumers import contract types only.

### Authorization

Authorization belongs in `service-kit/src/policies`. `CallerTier` and the grading of a session into a tier live in `@chia/auth/tier`, because the auth server projects them onto `get-session` as `access`; that projection is for frontends, and no policy or guard reads it. Bind policies through `runPolicy` for oRPC or `toHonoMiddleware` for Hono. Guards contain transport binding, not duplicated authorization logic. Procedure rate-limit budgets live in `api/orpc/rate-limits.ts`, keyed by route family and caller tier; a tier the family does not list is uncounted, so `Root` is unlimited unless named. Mount-level budgets belong to the hosting app. The Hono mount resolves the caller once and puts it on `ServiceContext.caller`; `callerPolicy` grades a pre-resolved caller instead of re-verifying credentials. API keys carry scopes from `@chia/auth/apikey`; a guard that admits `CallerTier.ApiKey` states the scopes it needs, and a key sent without them is refused even where a browser would pass. `operator:root` on a key the configured admin owns lifts it to `CallerTier.Root`; agent guards then take the user from the key.

### Context injection

`packages/api` reads no environment variables and holds no host state. `BaseOSContext` supplies:

- `config`: AI key material.
- `workflow`: the `@chia/workflow-control` client.
- `hooks`: optional feed and memory lifecycle hooks.
- `agentFactory`: optional per-kind bindings, dynamic definition loaders and credential handling.

`apps/service/src/factories/orpc.factory.ts` is the only place that constructs this context. Agent orchestration stays in `api/orpc/services/agent`; host apps supply bindings, not duplicate services or registries. Missing optional factories return `SERVICE_UNAVAILABLE`.

### Data and errors

- oRPC handlers use `@chia/db/repos/*`, not raw Drizzle.
- Write logic shared with workflow steps belongs in `api/<domain>/write` and receives lifecycle hooks explicitly.
- `feed_draft` is the only write path for post content shared by the editor, MCP and the writing agent; `api/feeds/draft` owns open, patch, apply, discard and restore. `feed` changes only through apply or the feed-level `feeds.update`, and only those start indexing. A writing session is not bound to a draft: `agent.writing_session_draft` records the drafts it worked on, and a prompt hands one over as an attachment that the kind's `attach` admits before the turn's run starts.
- Domain and policy failures use `AppError`; its codes mirror oRPC common codes.

## Core package boundaries

- Dates: persist and compare instants as `Date` (Drizzle `mode: "date"`) and ISO strings on the wire. Calendar, timezone, locale and display use `@chia/utils/day`. Do not import `dayjs` directly.
- `service-kit`: `createServiceFactory()` builds per-request `ServiceContext`; `bootstrap()` applies cross-cutting Hono middleware.
- `db`: every timestamp column is `timestamptz` (`withTimezone: true`); a plain `timestamp` would be read as UTC by Drizzle but written in the process's zone by a raw `sql` parameter. Timestamp columns use `mode: "date"`. `connectDatabase(env, { withCache })` is memoized by URL and cache setting. Request paths may use explicit Redis-backed Drizzle caching; workflow steps use `withCache: false`. All text and JSON parameters pass through `storableCodecs` before reaching Postgres.
- `auth`: Better Auth configuration and server/browser clients. Keep email providers and templates lazily imported.
- `kv`: shared Keyv adapters, the Drizzle cache and rate-limiter integration.
- `ai`: embeddings, chunking, content tools, provider model creation and API-key crypto. Keep provider SDKs lazily imported. `@chia/ai/provider` is the only definition of the vendors, the keys a caller may bring (each vendor or the gateway) and their cookie names; `@chia/ai/house-models` is the only place a house-billed model id is written, keyed by role. `@chia/ai/env` owns `EMBEDDING_PROVIDER`, `EMBEDDING_API_KEY` and `OLLAMA_BASE_URL`.
- `meta`: site metadata authored in Pkl, generated as `meta.json`.
- `themes`: HeroUI tokens are the only colour tokens; shadcn names (`primary`, `card`, `popover`, `muted-foreground`, `destructive`, `ring`) do not exist. `base.css` holds the font tokens, the token map, the Fumadocs `--color-fd-*` mapping, the compact HeroUI density overrides, the prose heading scale and base resets; `default.css` and `cyan.css` assign HeroUI colour, radius, sidebar and chart tokens only. Density is set once there through HeroUI BEM classes; call sites choose `size` and must not restate control heights in `className`. UI text follows the same scale as prose: `text-xl` section titles, `text-lg` card titles, `text-base` list titles, `text-sm text-muted` meta, weight 600 for headings and 500 for titles.
- `ui`: HeroUI is the component library. Remaining radix/shadcn components exist only where HeroUI has no equivalent (`cmd`, `navigation-menu`, `sidebar`, `field`, `dialog`, `sheet`, `empty`); do not add new ones.

## Agent packages

Read [`docs/agent-architecture.md`](../docs/agent-architecture.md) before changing this subsystem.

| Package          | Boundary                                                                       |
| ---------------- | ------------------------------------------------------------------------------ |
| `agent-runtime`  | Kind-independent session, turn, tool, compaction, wire-event and model runtime |
| `agent-content`  | Shared read-only content tools, `ContentReadPort` and `ProfileReadPort`        |
| `agent-writing`  | Writing prompts, tools, policy, state and content/web ports                    |
| `agent-public`   | Public reader prompt, policy and model policy                                  |
| `agent-elements` | Client session store, queries, providers and UI components                     |

`agent-runtime` exports `./pi/*`, `./session/*` and `./models` for server use only. Browser and SSR bundles may import `./wire/schema` and `./wire/fold`; `./wire/replay` remains server-only because it loads Pi.

`agent-elements` owns live client state in one zustand store per session and server state in TanStack Query. Hosts provide the oRPC client, `QueryClient`, localized labels and kind-specific renderers. Host context is a separate store (`./context`) mounted above the pages and the session: pages provide attachable records while mounted, the composer lists them, and the session store attaches the ones the operator has not detached to every prompt and command. A `once` item is withdrawn after the first prompt carries it; a pending `AgentContextRequest` is sent by whichever session under the provider can next take a prompt. `agentAttachmentInputSchema` in `@chia/agent-runtime/wire/schema` is the only definition of an attachment; `./attachment` derives keys and labels from it and `./selection` turns a DOM selection into one. `./markdown` renders a link into the page's own origin as a site link and asks before any other; a host with a client router hands its link component to `SiteLinkProvider`. Links take the `link` utility from `@chia/themes/base.css`, the same rule blog prose applies. Host Tailwind sources must include this package and Streamdown's distributed JavaScript. Every locale must carry the same keys; agent label tests enforce this.

## Testing

`@chia/test` must not depend on other `@chia/*` packages.

- `@chia/test/config` — `nodeConfig` / `domConfig`. App configs add `setupFiles`. DOM Testing Library tests must `cleanup()` in setup.
- `@chia/test/env` — `stubTestEnv()`.
- `@chia/test/session`, `@chia/test/context` — `sessionOf`, `contextOf`, `serviceContextOf`.
- `@chia/test/orpc` — `session` fixture; extend `context` in the consumer. Import `vi` from `vitest`.
- `@chia/test/mocks/*` — `vi.mock` wiring stays in the consumer.
- `@chia/test/fixtures/content-read-port`, `@chia/test/fixtures/profile-read-port` — read-port fakes.

Keep app-specific helpers next to the app. Import `{ describe, expect, it, vi }` from `vitest`. Titles are behavior sentences, not `should ...`.
