# Service 傳輸層統一與服務拆分規劃

> 狀態：Phase 0–5 已實作；Phase 6 未開始  
> 建立日期：2026-07-25  
> 最後更新：2026-07-25  
> 範圍：`apps/service` 的 Hono routes 與 `packages/api/orpc` 的 RPC endpoint 統一；為 `apps/auth`、`apps/ai`、`apps/content` 拆分鋪路

## 0. 執行狀態

| Phase                                  | 狀態      | 備註                                                  |
| -------------------------------------- | --------- | ----------------------------------------------------- |
| Phase 0：consumer 型別去耦 + 既有缺陷  | ✅ 已實作 | 5 個缺陷全修；`adminGuard` 拆成兩個 guard             |
| Phase 1：`packages/service-kit` 基礎   | ✅ 已實作 | `ServiceContext` 為 type alias（Hono `Env` 約束所需） |
| Phase 2：Policy 抽離（guard 只寫一次） | ✅ 已實作 | 6 個 policy + 15 個新測試；自寫 rate limiter          |
| Phase 3：掛 OpenAPIHandler + spec      | ✅ 已實作 | `/api/v1/openapi.json`；REST 錯誤格式正規化           |
| Phase 4：Hono 業務 route 遷移至 oRPC   | ✅ 已實作 | 15 個端點，URL 全部不變；見下方實作決策               |
| Phase 5：移除 `hc` client              | ✅ 已實作 | `AppRPC` 已移除；dash AI 改手寫 fetch wrapper         |
| Phase 6：按 domain 拆包 → 拆 app       | ⬜ 未開始 | 前置條件見 §9.3，跨服務 session 驗證仍待決策          |

### 與原規劃的差異（實作決策）

1. **`toORPCMiddleware(policy)` 泛型 adapter 不可行**。oRPC 會用 input context 約束 middleware 的 output context，泛型 patch 型別無法滿足。改為 `runPolicy(policy, context)` 執行器 + 每個 guard 6 行綁定（`packages/api/orpc/guards/*`），邏輯仍只有一份。Hono 側額外提供 `applyPolicy(c, policy)` 供需要先讀 request 的情況（AI guard 從 body 取 provider、`feeds/search` 依 query 決定是否需要 root）。
2. **`rateLimit` 自行實作而非包 `hono-rate-limiter`**（`packages/service-kit/src/policies/rate-limit.policy.ts`，含 draft-6 headers）。這是「per-procedure rate limit」的前提；`hono-rate-limiter` 依賴已移除。
3. **`GET /admin/public/feeds` 未併入 `feeds["admin-list"]`**（原 §7 表格）。兩者 auth 不同：前者要 API key（內容管線 / www 伺服器端），後者公開（www 客戶端無限滾動）。合併必然放寬其中一邊，因此保留為 `content.feeds.list` 與 `feeds["admin-list"]` 兩個 procedure。`POST /admin/public/feeds/:id` 同理未併入 `feeds.update`。
4. **公開 feeds procedure 放在新的 `content.feeds.*` namespace**，既有的 `feeds.*`（session 驗證）維持原位。Phase 6 再一次把兩組都收進 `content`。
5. **REST 與 RPC 的錯誤格式分別處理**。`OpenAPIHandler` 加了 `rootInterceptors` 把 oRPC 錯誤 body 改寫成 `errorGenerator` 形狀（前端 `libs/service/error.ts` 解析的格式），RPC 面維持 oRPC 原生格式（其 client 需要）。見 `apps/service/src/factories/orpc-error.factory.ts` 與 `__tests__/error-shape.controller.test.ts`。
6. **Algolia / Resend client 改為 lazy**。`packages/api/algolia/client.ts` 原本在 module scope 呼叫 `algoliasearch()`，`appId` 為空會 throw；`content.route.ts` → `router.ts` → dash 的 in-process RSC client 使得 dash 啟動失敗。改為 `getAlgoliaClient()`；`RESEND_API_KEY` 改為 optional 並在 `sendContactEmail` 內檢查。回歸測試：`packages/api/__tests__/router-import.test.ts`。
7. **`publicFeedsInfiniteSchema` 的布林欄位接受 boolean 與字串兩種**（`z.union([z.boolean(), z.stringbool()])`）。同一個 procedure 同時服務 RPC（真 JSON）與 `GET /admin/public/feeds`（全字串）。回歸測試：`__tests__/content-surfaces.controller.test.ts`。
8. **前端不再有 service / resource 包裝層**。oRPC consumer 直接用 `orpc.<path>.queryOptions()` / `.mutationOptions()` 搭配 react-query；RSC 直接 `await client.<path>(...)`（NOT_FOUND 用 `@orpc/client` 的 `safe()`）。已刪除 `apps/www/src/services/{feeds,email,spotify,toolings}.service.ts` 與 `apps/dash/src/resources/feed.resource.ts`。唯一保留的 wrapper 是 `apps/dash/src/libs/service/fetcher.ts`，因為 AI 端點留在 Hono（streaming / cookie）。
9. **captcha token 從 header 改為 procedure input**。原本走 `x-captcha-response` header，會迫使 client 傳 per-call context，`mutationOptions()` 就用不了。改為 contract input 的 `captchaToken` 欄位，guard 以 `.use(captchaGuard, (input) => ({ token: input.captchaToken }))` 取用。連帶刪除已無 route 使用的 Hono `siteverify` guard 與 www client 的 `ClientContext`。回歸測試：`apps/service/__tests__/captcha.controller.test.ts`（不 mock guard，直接驗證 provider 拒絕時不會寄信）。
10. **修正 `db.mock.ts` 的 feed fixture**。原本造了 `{ items, meta: { nextCursor, hasMore } }`，但 `queryInfiniteFeeds` 實際回傳 `{ items, nextCursor }`——舊測試在斷言一個 production 不存在的形狀。oRPC 的 output validation 抓到了這點，fixture 與該斷言已更正。

### 主要落點

- 共用套件：`packages/service-kit/`（context / errors / policies / adapters / bootstrap / maintenance）
- oRPC guards：`packages/api/orpc/guards/*.guard.ts`；per-app 設定 `packages/api/orpc/config.ts`；domain event `packages/api/orpc/events.ts`
- 新 contract / route：`packages/api/orpc/{contracts,routes}/{content,email,media,toolings}.*`
- 搬移的 service：`packages/api/feeds/search.ts`、`packages/api/spotify/playback.ts`、`packages/api/email/index.ts`
- 兩個 handler 掛載：`apps/service/src/routes/{rpc,openapi}.route.ts`；共用 `src/factories/orpc.factory.ts`
- 留在 Hono：`auth`、`ai`、`spotify/oauth/callback`、`health`

## 1. 背景與問題

`apps/service` 目前是 Nitro + Hono 單一服務，同時存在兩套 API 表達方式：

- **Hono 原生 routes**（`src/routes/*.route.ts`）：8 個 route 檔，用 `@hono/zod-validator` + `c.json(errorGenerator(...))`，consumer 透過 `hc<AppRPC>` 取得型別。
- **oRPC contract-first RPC**（`packages/api/orpc/`）：contract（`contracts/*.contract.ts`）與實作（`routes/*.route.ts`）分離，透過 `src/routes/rpc.route.ts` 掛在 `/api/v1/rpc`。

兩套並存造成三個具體代價：

1. **Guard 重複實作**：`apps/service/src/guards/auth.guard.ts` 與 `packages/api/orpc/guards/auth.guard.ts` 是同一個政策的兩份程式碼；`admin` 同理，且 `packages/api/orpc/routes/spotify.route.ts` 還自己寫了第三份 `spotifyManageGuard`。反之 `rate-limiter` / `apikey-verify` / `captcha` 只有 Hono 版，oRPC 側完全沒有 per-procedure rate limit（只有 `/rpc` 前綴一個粗粒度的）。
2. **Context 抄兩遍**：`apps/service/src/global.d.ts` 的 `Variables` 與 `packages/api/orpc/utils.ts` 的 `BaseOSContext` 各自定義，`rpc.route.ts:36-50` 手動逐欄映射。
3. **拆服務會炸前端型別**：`hc<AppRPC>` 必須 `import type { AppRPC } from "~service/server"`，型別綁在「整個 server 的 route 組合」上。拆成三個 app 後 `AppRPC` 不存在，所有 call site 需重寫。

同時已有重複端點：oRPC 的 `feeds["admin-list"]`（`adminGuard({ enabled: false })`，實際上公開）與 Hono 的 `GET /api/v1/admin/public/feeds` 幾乎等價，但 `apps/www` 走 Hono、dashboard 走 oRPC。

**目標**：oRPC 成為唯一的 application contract 層，Hono 退回 transport / adapter 層；guard、context、error 各只有一份實作；contract 按 domain 切，使拆服務只是「換掉掛載位置」而非重寫。

## 2. 架構決策

### 2.1 分層而非二選一

- **oRPC 管 application procedure**：所有有輸入輸出結構的業務端點。
- **Hono 管 HTTP / browser / infra 語義**：redirect、Set-Cookie、stream、webhook 驗簽、LB probe、第三方 handler 委派。

保留在 Hono 的完整清單（其他全部遷移）：

| 檔案                                                         | 保留原因                              |
| ------------------------------------------------------------ | ------------------------------------- |
| `src/routes/auth.route.ts`                                   | better-auth 自己接管 Request/Response |
| `src/routes/spotify.route.ts` 的 `/oauth/callback`           | 302 redirect，瀏覽器導航              |
| `src/routes/ai.route.ts` 的 `/key:signed`                    | Set-Cookie                            |
| `src/routes/ai.route.ts` 的 `/generate`、`/content/generate` | AI SDK text stream response protocol  |
| `src/routes/health.route.ts`                                 | LB probe，需在 db/kv 不可用時仍能回應 |
| （未來）webhook                                              | raw body 簽章驗證                     |

### 2.2 REST 相容：OpenAPIHandler

在 contract 加 `.route({ method, path })`，同時掛 `RPCHandler`（`/api/v1/rpc`）與 `OpenAPIHandler`（`/api/v1`）。同一個 procedure 因此同時提供：

- typed RPC client（www / dash）
- 原本的 REST URL（遷移期間 URL 完全不變，外部 / 非 TS consumer 可用）
- 由 `OpenAPIGenerator` 產生的 OpenAPI spec

需新增依賴 `@orpc/openapi`（目前 lockfile 只有 client / contract / server），版本對齊 `pnpm-workspace.yaml` 的 `orpc` catalog（`1.14.8`）。

### 2.3 共用套件：`packages/service-kit`

新增 workspace 套件 `@chia/service-kit`，放 transport-agnostic 的部分：

```
packages/service-kit/
  context.ts        # ServiceContext（單一定義，取代 Variables + BaseOSContext）
  errors.ts         # AppError + code → HTTP status 對照
  policies/         # session / admin / apikey / captcha / rate-limit（純函式）
  adapters/hono.ts  # toHonoMiddleware(policy)
  adapters/orpc.ts  # toORPCMiddleware(policy)
  bootstrap.ts      # 由 apps/service/src/bootstrap.ts 抽出，供每個 service app 共用
```

不放在 `packages/api`：後者已含 github / spotify / s3 / algolia / captcha / betterstack，拆服務時每個 app 都會拉到不需要的依賴。

### 2.4 Domain 邊界

contract 與實作都按未來的服務邊界分組，對齊 `packages/utils/src/schema/index.ts:31` 已定義的 `Service` enum：

| Domain     | 內容                             | 目標 app                            |
| ---------- | -------------------------------- | ----------------------------------- |
| `identity` | auth、apikey、organization、user | `apps/auth`（`Service.Auth`）       |
| `content`  | feeds（含 public 讀取、search）  | `apps/content`（`Service.Content`） |
| `ai`       | content 生成、embedding search   | `apps/ai`（`Service.AI`）           |
| `media`    | spotify、file/s3                 | 暫留 `apps/service`                 |
| `toolings` | link-preview、email              | 暫留 `apps/service`                 |

**鐵則：consumer 只能 import contract，不能 import router。**

## 3. Phase 0 — consumer 型別去耦 + 既有缺陷（低風險，先做）

### 3.1 dash oRPC client 改用 contract 型別

`apps/dash/src/libs/orpc/client.ts` 目前用 `RouterClient<typeof router>`（`import type { router } from "@chia/api/orpc/router"`），會把 drizzle / better-auth / db 全部拉進 dash 的型別圖。

改成與 `apps/www/src/libs/orpc/client.ts:17` 一致的 `ContractRouterClient<typeof routerContract>`（來自 `@chia/api/orpc/contracts`），含 `globalThis.$client` 的宣告。

### 3.2 修掉探索時發現的缺陷

| 位置                                                | 問題                                                                                                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/service/src/routes/rpc.route.ts:24`           | `once()` 包在 middleware callback 內，每個 request 都建立新的 `once` 包新 function → 每個 request 都 `new RPCHandler()`。應提到 module scope，sentry 改由 interceptor 取得 |
| `apps/service/src/factories/app.factory.ts:20`      | `return c.json(errorGenerator(503))` 未帶 status → db 連線失敗時回 **200** 帶錯誤 body                                                                                     |
| `packages/api/orpc/guards/admin.guard.ts:39`        | `options.enabled` 為 false 時 `sessionData` 可能是 `undefined`，`if (sessionData && ...)` 整段檢查被跳過 → 直接放行                                                        |
| `apps/service/src/guards/rate-limiter.guard.ts:165` | 殘留 `console.log(key)`                                                                                                                                                    |
| oRPC `health.server` vs Hono `GET /api/v1/health`   | 重複；`health.server` 無任何 consumer（已確認 www / dash 皆未使用）→ 移除 oRPC 側，保留 Hono probe 與 oRPC `health.client`                                                 |

## 4. Phase 1 — `packages/service-kit` 基礎

### 4.1 `ServiceContext` 單一定義

```ts
// packages/service-kit/context.ts
export interface ServiceContext {
  headers: Headers;
  clientIP: string;
  db: DB;
  kv: Keyv;
  auth?: Auth;
  session?: Session | null;
}
```

- `apps/service/src/global.d.ts` 的 `Variables` 改為 `ServiceContext`（`clientIP` 已由 `app.factory.ts:23` 設定，`headers` 由 adapter 補）。
- `packages/api/orpc/utils.ts` 的 `BaseOSContext` 改為 `extends ServiceContext`。
- `rpc.route.ts` 的手抄映射退化為展開 `c.var`。

### 4.2 移除 `hooks` bag

`BaseOSContext.hooks` 目前混了兩種東西，拆開：

- `onError` / `onUnauthorized` / `onForbidden`（`guards/auth.guard.ts:15`、`guards/admin.guard.ts:44`、`routes/spotify.route.ts` 各處）→ 改用 handler-level interceptor（`rpc.route.ts` 已有 `onError` interceptor 可擴充），guard 內只 `throw errors.X()`。
- `onFeedChanged` / `onFeedRemoved`（`rpc.route.ts:42-49` → `services/feed-indexing.service.ts`）→ 改為 domain event / 明確注入的 port，不放在 request context。這是拆 content service 時的關鍵：否則 context 型別會把 indexing 依賴傳染到每個 app。

### 4.3 `AppError` 與 error mapping

目前有四種錯誤表達：`errorGenerator`（`@chia/utils/server`）、`errorResponse`（zod → `apps/service/src/utils/error.util.ts`）、`HTTPException`、`ORPCError`。

定義 `AppError { code, issues? }`，兩個 adapter 各自轉換；`errorGenerator` 保留為最終 HTTP body 產生器（既有前端 `libs/service/error.ts` 依賴其格式）。**這一步必須在 Phase 3 之前完成**，否則同一資源的 REST 與 RPC 會吐兩種 error body。

### 4.4 `bootstrap` 抽出

`apps/service/src/bootstrap.ts`（logger / sentry / onError / maintenance / cors）與 `src/factories/app.factory.ts`（db / kv / auth 注入）搬進 service-kit，`apps/service` 只保留自己的 `env.ts` 與 route 組合。這樣 `apps/auth` / `apps/ai` / `apps/content` 開新 app 時是 10 行的事。

## 5. Phase 2 — Policy 抽離

每個 policy 是純函式，回傳成功 patch 或 `AppError`：

```ts
// packages/service-kit/policies/session.policy.ts
export const sessionPolicy =
  (opts?: { rootOnly?: boolean }) =>
  async (ctx: ServiceContext): Promise<PolicyResult<{ session: Session }>> => {
    /* ... */
  };
```

要抽的 policy 與其來源：

| Policy      | Hono 來源                                                              | oRPC 來源                                                                                                                                                              |
| ----------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session`   | `src/guards/auth.guard.ts`                                             | `packages/api/orpc/guards/auth.guard.ts`                                                                                                                               |
| `admin`     | （無）                                                                 | `packages/api/orpc/guards/admin.guard.ts` + `routes/spotify.route.ts` 的 `spotifyManageGuard`（合併為 `admin({ roles })` 與 `admin({ pinToAdminId: true })` 兩種用法） |
| `apikey`    | `src/guards/apikey-verify.guard.ts`                                    | （無）                                                                                                                                                                 |
| `captcha`   | `src/guards/captcha.guard.ts`                                          | （無）                                                                                                                                                                 |
| `rateLimit` | `src/guards/rate-limiter.guard.ts`（含 `KeyvStore`，整個搬過去可重用） | （無，只有 `/rpc` 前綴一個）                                                                                                                                           |
| `aiApiKey`  | `src/guards/ai.guard.ts`                                               | （無）                                                                                                                                                                 |

adapter：`toHonoMiddleware(policy)` → `createMiddleware` + `c.json(errorGenerator(...))`；`toORPCMiddleware(policy)` → `.middleware()` + `throw errors.X()`。

測試影響：`apps/service/__tests__/setup.ts` 用 `vi.mock("../src/guards/*")` 逐個 mock guard。policy 集中後改為 mock `@chia/service-kit/policies`（或提供 `__mocks__` 匯出），`__tests__/__mocks__/guards.mock.ts` 一併調整。

## 6. Phase 3 — OpenAPIHandler + spec

1. `packages/api` 與 `apps/service` 新增 `@orpc/openapi`（catalog `orpc`）。
2. 在既有 contract 補 `.route({ method, path })`。命名對齊 REST 慣例，但**新增的 public procedure 必須沿用 Phase 4 要取代的 Hono URL**（見 §7 對照表），使 URL 在遷移期間零變動。
3. `apps/service/src/routes/` 新增 `openapi.route.ts`：`OpenAPIHandler(router)` 掛在 `/api/v1`，放在所有 Hono route **之後**（fallthrough），避免與 `/auth`、`/health` 等保留路徑衝突。
4. 用 `OpenAPIGenerator` 產出 spec，掛 `/api/v1/openapi.json`（+ 可選 scalar docs UI）。
5. 兩個 handler 共用同一份 interceptor（sentry / error mapping），避免 §4.3 的格式分歧。

## 7. Phase 4 — Hono 業務 route 遷移

順序：`toolings` → `email` → `media` → `content`（依 call site 數量由少到多）。每個 domain 一個 PR。

| Hono 端點（現況）                              | 目標 oRPC procedure                       | 備註                                                                  |
| ---------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| `POST /api/v1/toolings/link-preview`           | `toolings["link-preview"]`                | jsdom + kv cache 邏輯照搬                                             |
| `POST /api/v1/email/send`                      | `toolings.email.send`                     | 掛 `captcha` + `rateLimit` policy                                     |
| `GET /api/v1/spotify/playlist/:id`             | `media.spotify.playlist`                  |                                                                       |
| `GET /api/v1/spotify/playing`                  | `media.spotify.playing`                   | `SpotifyCredentialUnavailableError` → `SERVICE_UNAVAILABLE`           |
| `GET /api/v1/feeds/public/search`              | `content.feeds["public-search"]`          |                                                                       |
| `GET /api/v1/feeds/search`                     | `content.feeds.search`                    | 需 `session` + `aiApiKey` policy（條件式，見 `feeds.route.ts:51-58`） |
| `GET /api/v1/admin/public/feeds`               | 併入既有 `feeds["admin-list"]`            | 兩者已幾乎等價，統一為一個 public procedure                           |
| `GET /api/v1/admin/public/feeds:meta`          | `content.feeds["public-total"]`           | 新增                                                                  |
| `GET /api/v1/admin/public/feeds/:slug`         | `content.feeds["public-details-by-slug"]` | 新增（既有 `details-by-slug` 是 authGuard，不能共用）                 |
| `GET /api/v1/admin/public/feeds:id/:id`        | `content.feeds["public-details-by-id"]`   | 同上                                                                  |
| `GET /api/v1/admin/public/feeds/:slug/related` | `content.feeds["public-related"]`         | 新增                                                                  |
| `POST /api/v1/admin/public/feeds:translation`  | `content.feeds["translation:upsert"]`     | `apikey` policy（`env.PROJECT_ID`）                                   |
| `POST /api/v1/admin/public/feeds:content`      | `content.feeds["content:upsert"]`         | 同上                                                                  |
| `POST /api/v1/admin/public/feeds/:id`          | 併入既有 `feeds.update`                   | 改為 `apikey` 或 `session` 二者皆可的 policy 組合                     |

遷移每個端點時同步更新 call site。`hc<AppRPC>` 的型別會在 route 從 `AppRPC` 消失時自動報錯，等於免費的 checklist：

- `apps/www`：`app/sitemap.ts`、`hooks/use-search-feeds.ts`、`services/{feeds,email,spotify,toolings}.service.ts`、`components/{contact/contact,commons/current-playing,commons/preview-link}.tsx`
- `apps/dash`：`resources/feed.resource.ts`、`hooks/use-search-feeds.ts`

`apps/service/__tests__/*.controller.test.ts` 目前用 `app.request("/api/v1/...")` 打真實 URL。因 Phase 3 已保留相同 URL，這些測試在遷移後**應繼續通過**——這是驗證遷移正確性的主要手段，遷移期間不要改它們。

## 8. Phase 5 — 移除 `hc` client

Phase 4 完成後，剩下的 Hono 端點都是瀏覽器導航 / 原生 fetch / stream，不需要 typed client：

- 刪 `apps/www/src/libs/service/client.ts`、`client.rsc.ts`、`apps/dash/src/libs/service/client.ts`
- `apps/dash/src/resources/ai.resource.ts`（`key:signed` / `generate` / `content/*`）改為手寫 fetch wrapper 或 AI SDK 的 client，`InferRequestType` / `InferResponseType` 換成從 `@chia/ai` 的 zod schema 推導
- `apps/service/src/server.ts` 移除 `export type AppRPC`
- 保留 `libs/service/error.ts`（error body 解析仍需要）

## 9. Phase 6 — 按 domain 拆包 → 拆 app

### 9.1 先拆包（同一個 app 內）

```
packages/api/orpc/
  contracts/{identity,content,ai,media,toolings}/   # 每個 domain 一個 entry
  routes/{identity,content,ai,media,toolings}/
```

`router.contract.ts` / `router.ts` 改為聚合各 domain。`packages/api/package.json` 的 `exports` 補上 per-domain subpath（例如 `./orpc/contracts/content`），讓未來的 app 只 import 自己需要的部分。

### 9.2 再拆 app

每個新 app（`apps/auth`、`apps/ai`、`apps/content` 目前是空目錄）就是：

```ts
// apps/content/src/server.ts
export const app = bootstrap(appFactory.createApp())
  .basePath("/api/v1")
  .route("/health", healthRoutes)
  .route("/rpc", rpcRoutes(contentRouter)); // 只掛自己 domain 的 router
```

搭配：

- **Gateway**：`apps/gateway/{nginx,caddy}` 依 path prefix 分流（`/api/v1/rpc/content/*` → content service）。
- **Client**：`withServiceEndpoint(path, Service.Content, ...)` 已支援 per-service URL（`packages/utils/src/config/index.ts:291`）。若要一個 client 打多個服務，用 `@orpc/client` 的 `DynamicLink` 依 procedure path 選 link，contract 維持聚合，前端 call site 零改動。
- **服務間呼叫**：用 `RouterClient` 型別 + RPCLink 建 typed internal client；服務仍同進程時可改用 oRPC 的 `call()` 直接跑，型別相同。

### 9.3 拆分前置條件檢核

- [ ] Phase 0 §3.1 完成（consumer 不再 import router）
- [ ] Phase 1 §4.2 完成（`hooks` 已移出 context）
- [ ] Phase 2 完成（policy 在 service-kit，新 app 不需複製 guard）
- [ ] `better-auth` 的 session 驗證在拆分後如何跨服務：`sessionPolicy` 目前呼叫 `ctx.auth.api.getSession()`，需要 db 連線。拆 auth service 後，其他服務應改呼叫 auth service 的 `identity.session.verify` procedure（新增），或共用 JWT/cookie 驗證而不打 db——**此決策需在 Phase 6 開始前單獨評估**，不在本規劃內定案。

## 10. 驗證方式

每個 Phase 的驗證：

1. `pnpm -F service type:check && pnpm -F service lint`；跨 package 改動跑 `pnpm turbo type:check`
2. `pnpm -F service test`（`apps/service/__tests__/*.controller.test.ts` 打真實 URL，是 Phase 3/4 URL 不變的主要保證）
3. `pnpm -F service dev`（Nitro）後手動打：
   - `curl localhost:<port>/api/v1/health`
   - `curl localhost:<port>/api/v1/openapi.json`（Phase 3 後）
   - 每個遷移端點的舊 URL 與新 `/rpc` 路徑，比對 response body 一致
4. `pnpm -F www dev` / `pnpm -F dash dev`，驗證首頁 feed 列表、feed 搜尋、聯絡表單、link preview、current playing、dashboard feed CRUD 與 AI 生成
5. Phase 6 拆分後：用 `service.docker-compose.yaml` 起多服務 + gateway，重跑第 4 點
