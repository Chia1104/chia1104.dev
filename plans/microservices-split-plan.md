# Microservices 拆分規劃（Auth / AI / Workflow）

> 狀態：Phase 0–4 程式碼實作完成（`refactor/micro-services`），部署與部署後驗收未進行
> 建立日期：2026-07-17
> 最後更新：2026-07-18
> 範圍：`apps/service` monolith 拆分為 auth / ai / workflow 三個獨立服務，production 以 Caddy 做邊緣轉發，本地開發以獨立簡易 dev proxy 轉發
> 前置：`refactor/auth-service` branch（auth 拆分雛形，1 個 WIP commit）

## 0. 執行狀態

| Phase                              | 狀態          | 備註                                                                                                           |
| ---------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------- |
| Phase 0：auth branch 收尾與部署    | 🟨 程式碼完成 | commit `c0e02369`；Railway 部署（步驟 4）待執行                                                                |
| Phase 1：dev proxy + 共用 plumbing | ✅ 完成       | commit `b402f966`；dev proxy 已端到端驗證（block / gate / rewrite / proxy）                                    |
| Phase 2：`apps/ai` 拆分            | 🟨 程式碼完成 | commit `1f6cf8a5`；package 名為 `ai-service`（避免與 npm `ai` 撞名）；部署與串流實測（步驟 4–5）待執行         |
| Phase 3：`apps/workflow` 拆分      | 🟨 程式碼完成 | Nitro build + internal route 煙霧測試通過；部署與驗收（步驟 5–6）待執行                                        |
| Phase 4：client 切換與清理         | 🟨 部分完成   | dash 已切 `Service.AI`（與 Phase 2 同 commit，型別相依必須同步切）；`/api/v1/ai` 過渡 rewrite 待部署驗證後移除 |

### 實作備註（2026-07-18）

- `apps/ai` 的 workspace package 名稱為 **`ai-service`**（非計畫中的 `ai`）：與 npm 的 Vercel AI SDK `ai` 套件撞名會讓 manypkg / pnpm 把 `"ai": "catalog:ai"` 誤判為 workspace 依賴。turbo filter、CI、Dockerfile scope 均用 `ai-service`。
- `guards/ai.guard.ts` 與 `AI_AUTH_PRIVATE_KEY` **保留一份在 `apps/service`**：`/feeds/search` 需要驗簽 provider-key cookie 做 query embedding（§1.3/§9 的既定場景）；`AI_AUTH_PUBLIC_KEY`（簽發側）只在 `apps/ai`。
- `AlgoliaFeedHit` 提升到 `@chia/api/algolia/types`：workflow steps（寫入側）與 service feeds search（讀取側）共用同一份 index 文件 shape。
- Caddy gateway 改為 repo-root build context（`infra/railway/gateway.json` 指定 `dockerfilePath`），與其他 Railway service 一致。
- 既有測試 `admin.controller.test.ts` 的 related feeds timeout 在拆分前（`c0a3e7cd`）即失敗，與本拆分無關。

### 已定案的決策

1. **AI 與 workflow 拆成兩個獨立服務**，服務間 workflow 觸發走 **internal HTTP request**（不共用 workflow world、不做 in-process fallback，見 §5）。
2. **部署平台以 Railway 為主**：僅 gateway（Caddy）有 public domain，auth / ai / workflow / service 全部走 Railway private network（IPv6）。
3. **本地開發不跑 Caddy**：以獨立的 Hono + Bun 簡易 proxy（`apps/gateway/dev-proxy`）模擬 Caddyfile 的路由與 forward_auth 行為。
4. `Service.Content`（feeds / admin / rpc）**暫時留在 `apps/service`**，等 auth / ai / workflow 拆完、legacy service 自然縮小後再另案評估。

## 1. 現況盤點

### 1.1 Monolith 現況（`apps/service`，Nitro + Hono，port 3005 / docker 8080）

`apps/service/src/server.ts` 以 basePath `/api/v1` 掛載：

| 路由                                                               | 內容                                       | 拆分去向                     |
| ------------------------------------------------------------------ | ------------------------------------------ | ---------------------------- |
| `/auth`                                                            | better-auth handler                        | → `apps/auth`（branch 已做） |
| `/ai`                                                              | generate / models / content/* / key:signed | → `apps/ai`                  |
| （in-process）                                                     | workflows / steps / workflow world         | → `apps/workflow`            |
| `/feeds` `/admin` `/rpc` `/spotify` `/email` `/toolings` `/health` | Content 與雜項                             | 留在 `apps/service`          |

### 1.2 `refactor/auth-service` branch 已建立的模式（本規劃的基礎）

- **`apps/auth`**：Hono on Bun 獨立服務（port 3006 / docker 8080），basePath `/auth`：
  - better-auth catch-all（`c.var.auth.handler(c.req.raw)`）
  - `GET /auth/internal/gate`：Caddy `forward_auth` 的邊緣驗證端點——session cookie 或 API key 驗證通過回 `204` + `x-ch-auth-session` / `x-ch-auth-api-key` trusted headers；`?mode=optional` 時匿名也回 204（不帶 headers）
  - `POST /auth/internal/verify-api-key`：包裝 SERVER_ONLY 的 `verifyApiKey`
  - internal 路由由 `internalGuard()` 保護：`x-ch-internal-token` 與 `INTERNAL_AUTH_SERVICE_TOKEN` 做 timing-safe 比對
- **`packages/auth/src/gateway.ts`（`@chia/auth/gateway`）**：
  - `AuthGatewayApi` 介面——in-process better-auth 與 `createRemoteAuthGateway`（HTTP-backed）都滿足，呼叫端無感
  - `encodeTrustedHeader` / `decodeTrustedHeader`（base64url JSON）、header 常數、`HOP_BY_HOP_HEADERS` sanitizer
- **`apps/gateway/caddy/Caddyfile`**：剝除 client 偽造的 trusted headers → block `/auth/internal/*` → `/auth/*` 與 `/api/v1/auth/*`（rewrite）→ auth upstream → `/api/v1/*` 先 `forward_auth` gate 再 proxy 到 service
- **`apps/service` 消費端**：`getAuthGateway = once(...)`——`INTERNAL_AUTH_SERVICE_ENDPOINT` 有設走 remote，沒設 fallback in-process `createAuth(db, kv)`；guards fast-path 直接 decode trusted header，缺席時 fallback 呼叫 gateway API

### 1.3 AI 相關現況

- 路由：`apps/service/src/routes/ai.route.ts`（`/api/v1/ai/*`）——`POST /key:signed`（provider key 簽名 cookie）、`POST /generate`（streamText 串流）、`GET /models`、`POST /content/{meta,generate,complete}`
- Guards：`rateLimiterGuard` → `verifyAuth()`（session 必須）→ `verifyAuth(true)`（`/content/*` root-only）→ `ai()` guard（`AI_AUTH_PRIVATE_KEY` 驗簽 cookie）
- 前端只有 `apps/dash` 使用：`useCompletion`（`withServiceEndpoint("/ai/generate", Service.LegacyService)`）+ hono-rpc thin client；`apps/www` 零 AI 依賴
- 向量搜尋 `GET /api/v1/feeds/search` 在 `feeds.service.ts` in-process 呼叫 `@chia/ai/embeddings`——**不搬**，留在 service（見 §9）

### 1.4 Workflow 相關現況

- Vercel Workflow SDK（`workflow` 4.6.0）+ `workflow/nitro` module（`nitro.config.ts`），world 由 `WORKFLOW_TARGET_WORLD` 選擇 `@workflow/world-postgres` 或 `@workflow-worlds/redis`（plugins `start-pg-world.ts` / `start-redis-world.ts`）
- Workflows：`feed-indexing.workflow.ts`（reading-time + Algolia + embeddings，逐 translation）、`algolia-search.workflow.ts`（刪除）
- 觸發方式：**in-process `start()`**，經 `apps/service/src/services/feed-indexing.service.ts`，呼叫點在 `routes/admin.route.ts`（3 處）與 `routes/rpc.route.ts` 的 oRPC hooks（`onFeedChanged` / `onFeedRemoved`）——這是拆分要解的唯一耦合
- Steps 依賴 `@chia/db` repos、`@chia/ai` embeddings、`@chia/api/algolia`

### 1.5 已預留的拆分縫（可直接沿用）

- `packages/utils/src/schema/index.ts`：`Service` enum 已有 `Auth` / `Content` / `AI`
- `packages/utils/src/config/index.ts`：`serviceNameResolver` + `getServiceUrl` 已支援 per-service `INTERNAL_<SERVICE>_ENDPOINT`；`withServiceEndpoint` 已支援 version prefix 切換
- `packages/utils/src/config/env.ts`：`INTERNAL_AI_SERVICE_ENDPOINT`、`NEXT_PUBLIC_SERVICE_PROXY_ENDPOINT` 已存在
- `pnpm-workspace.yaml` 的 `apps/*` glob 已涵蓋新增的 app

## 2. 目標拓撲

```
                        public (Railway)
                              │
                    ┌─────────▼─────────┐
                    │  apps/gateway      │  Caddy（唯一 public domain）
                    │  （本地: dev-proxy │  header 防偽剝除 / forward_auth
                    │   Hono+Bun :8787） │
                    └──┬─────┬─────┬────┘
              private  │     │     │   network (IPv6)
        ┌──────────────┘     │     └──────────────┐
┌───────▼──────┐   ┌─────────▼───────┐   ┌────────▼────────┐
│  apps/auth   │   │    apps/ai      │   │  apps/service   │
│  Hono+Bun    │   │   Hono+Bun      │   │  Nitro+Hono     │
│  :3006 /auth │   │   :3007 /ai     │   │  :3005 /api/v1  │
└──────────────┘   └─────────────────┘   └───────┬─────────┘
                                                 │ internal HTTP trigger
                                        ┌────────▼────────┐
                                        │ apps/workflow    │  internal-only
                                        │ Nitro+Hono       │  （不經 gateway 對外）
                                        │ :3008 /workflow  │
                                        └─────────────────┘
```

| Service           | Runtime      | Dev port | Docker port | basePath    | 對外             |
| ----------------- | ------------ | -------- | ----------- | ----------- | ---------------- |
| gateway (Caddy)   | Caddy        | —        | `$PORT`     | —           | ✅ 唯一          |
| gateway dev-proxy | Hono + Bun   | 8787     | —（僅本地） | —           | 本地             |
| `apps/auth`       | Hono + Bun   | 3006     | 8080        | `/auth`     | 經 gateway       |
| `apps/ai`         | Hono + Bun   | 3007     | 8080        | `/ai`       | 經 gateway       |
| `apps/workflow`   | Nitro + Hono | 3008     | 8080        | `/workflow` | ❌ internal-only |
| `apps/service`    | Nitro + Hono | 3005     | 8080        | `/api/v1`   | 經 gateway       |

Runtime 選擇說明：

- `apps/ai` 用**純 Hono + Bun**（比照 `apps/auth`）：workflow 移走後 AI 路由不需要 Nitro，`bun build --compile` 單檔即可。
- `apps/workflow` **必須 Nitro**：`"use workflow"` / `"use step"` 指令需要 SDK 的 bundler transform，repo 只接了 `workflow/nitro` 這一條整合路徑。
- workflow world（`WORKFLOW_POSTGRES_URL` / `WORKFLOW_REDIS_URI`）由 `apps/workflow` **單獨持有**——兩個編譯產物共用一個 local world 是 SDK 未定義行為。

## 3. `apps/ai` 拆分明細

結構完全比照 `apps/auth`：

```
apps/ai/
  package.json               # name "ai"; deps: @chia/ai, @chia/auth, @chia/db, @chia/kv, @chia/utils,
                             #   ai, @ai-sdk/gateway, hono, @hono/sentry, hono-rate-limiter, zod
  turbo.json / tsconfig.json / oxlint.config.ts / global.d.ts
  Dockerfile                 # 比照 apps/auth：turbo prune --scope=ai --docker → bun compile
  src/
    server.ts                # basePath "/ai"；/internal、/health 先掛，再掛 AI 路由；export type AIAppRPC
    bootstrap.ts             # 複製 apps/auth（logger、sentry、onError）
    env.ts                   # PORT=3007；OPENAI/ANTHROPIC/GENAI/AI_GATEWAY keys、AI_AUTH_PUBLIC/PRIVATE_KEY、
                             #   OLLAMA_BASE_URL、INTERNAL_AUTH_SERVICE_ENDPOINT/TOKEN、RATELIMIT_*
    factories/app.factory.ts # db + kv + getAuthGateway = once(...)：remote or in-process（同 branch 模式）
    guards/ai.guard.ts       # 自 apps/service/src/guards/ai.guard.ts 搬移
    guards/rate-limiter.guard.ts  # 自 apps/service 複製（kv-backed）
    routes/ai.route.ts       # 自 apps/service/src/routes/ai.route.ts 搬移（路徑去掉 /api/v1 前綴）
    routes/health.route.ts
```

- **搬出 `apps/service`**：`routes/ai.route.ts`、`guards/ai.guard.ts`、AI 專屬 env（`AI_AUTH_*`、`ANTHROPIC_API_KEY`、`GENAI_API_KEY`）、`@ai-sdk/gateway` / `ai` 依賴
- **留在 `apps/service`**：`feeds.service.ts` 的 query embedding（`@chia/ai/embeddings` in-process），因此 service 保留 `OPENAI_API_KEY` / `AI_GATEWAY_API_KEY` / `OLLAMA_BASE_URL`
- **auth 消費**：與 branch 的 service 模式相同——guard fast-path `decodeTrustedHeader<Session>(X_CH_AUTH_SESSION)`（由 Caddy / dev-proxy 注入），缺席時 fallback `auth.api.getSession()`（remote gateway 或 in-process）

## 4. `apps/workflow` 拆分明細

```
apps/workflow/
  package.json               # name "workflow-service"（避免與 npm workflow 套件混淆，binary 名仍 workflow）
                             # deps: @chia/ai, @chia/api（algolia）, @chia/db, @chia/kv, @chia/utils,
                             #   workflow, @workflow/world-postgres, @workflow-worlds/redis,
                             #   hono, jsdom, reading-time-estimator, nitro
  nitro.config.ts            # 自 apps/service 搬移：modules ["workflow/nitro"]、traceDeps、preset bun/node
  plugins/start-pg-world.ts / start-redis-world.ts   # 自 apps/service/plugins 搬移
  turbo.json                 # env: WORKFLOW_TARGET_WORLD、WORKFLOW_POSTGRES_URL、WORKFLOW_REDIS_URI、
                             #   REDIS_URI、AI embedding keys、INTERNAL_WORKFLOW_SERVICE_TOKEN
  Dockerfile                 # 比照 Dockerfile.service（Nitro build），--scope=workflow-service
  src/
    server.ts                # basePath "/workflow"；掛 /internal 與 /health
    bootstrap.ts / env.ts    # PORT=3008
    guards/internal.guard.ts # 比照 apps/auth，token 換 INTERNAL_WORKFLOW_SERVICE_TOKEN
    routes/internal.route.ts # 見 §5
    routes/health.route.ts
    workflows/  steps/       # 自 apps/service/src/{workflows,steps} 整包搬移
    services/feed-indexing.service.ts  # in-process start() 呼叫移到這裡
```

- workflow service **沒有任何 public 路由**：gateway 不設它的 upstream，`/workflow/*` 對外一律 404
- steps 需要的 env：db、Algolia、embedding keys（`OPENAI_API_KEY` / `AI_GATEWAY_API_KEY` / `OLLAMA_BASE_URL`）——**這是兩服務拆分的代價**：AI provider keys 會同時存在 `apps/ai` 與 `apps/workflow`（workflow 只需 embedding 相關的最小集合，不需要 `AI_AUTH_*` 簽名金鑰）

## 5. Workflow internal HTTP trigger 設計

### 5.1 端點（`apps/workflow/src/routes/internal.route.ts`，`internalGuard()` 保護）

| 端點                                               | Body                      | 行為                                                          |
| -------------------------------------------------- | ------------------------- | ------------------------------------------------------------- |
| `POST /workflow/internal/workflows/feed-indexing`  | `{ feedID: number }`      | `start(feedIndexingWorkflow, [{ feedID }])` → `202 { runId }` |
| `POST /workflow/internal/workflows/algolia-delete` | `{ objectIDs: number[] }` | `start(deleteFeedFromAlgoliaWorkflow, ...)` → `202 { runId }` |

### 5.2 呼叫端（`apps/service/src/services/feed-indexing.service.ts` 改寫）

- 保留原 export 簽名——`routes/admin.route.ts`（3 處）與 `routes/rpc.route.ts` hooks 呼叫點**完全不動**
- `INTERNAL_WORKFLOW_SERVICE_ENDPOINT` 有設 → `POST {endpoint}/workflow/internal/workflows/...`，header 帶 `x-ch-internal-token: INTERNAL_WORKFLOW_SERVICE_TOKEN`
- 未設 → `console.warn` + no-op skip

### 5.3 決策說明

- **不共用 workflow world**：`start()` 需要編譯期的 workflow reference（`workflow/nitro` SWC transform 以 build-relative module specifier 命名 workflow），呼叫端 process 若沒有整套 workflow 編譯鏈就無法產生合法 reference；跨部署共用 local world 亦是 SDK 未定義行為。
- **不做 in-process fallback**（與 auth gateway 模式刻意不同）：auth 的 fallback 合理是因為身分驗證不可缺席；workflow fallback 則要求 `apps/service` 永久保留 workflow 編譯鏈，違背拆分目的。背景索引在 endpoint 未設時降級為 warn+skip，本地開發由 `dev:micro` 保證 workflow service 常駐（§7），實務上只有設定錯誤才會走到 skip。
- 若未來需要嚴格 fallback：把 workflows/steps 抽成 `@chia/workflows` shared package、兩邊都過 transform——需先以 `npx workflow validate` spike 驗證，另案處理。

## 6. Gateway：Caddyfile 演進與本地 dev proxy

### 6.1 Caddyfile（`apps/gateway/caddy/Caddyfile`，基於 branch 版本增量）

新增 env：`AI_UPSTREAM`（workflow 不對外，無 upstream）。順序由最特定到最泛：

```caddyfile
# （既有）剝除 client 傳入的 x-ch-auth-session / x-ch-auth-api-key（防偽）

handle /auth/internal/* { respond 404 }
handle /ai/internal/*   { respond 404 }   # 新增
handle /workflow*       { respond 404 }   # 新增：workflow 完全不對外

handle /auth/*        { reverse_proxy {$AUTH_UPSTREAM} }
handle /api/v1/auth/* { uri replace /api/v1/auth /auth
                        reverse_proxy {$AUTH_UPSTREAM} }

# 新增：AI service
handle /ai/* {
    forward_auth {$AUTH_UPSTREAM} {
        uri /auth/internal/gate?mode=optional
        header_up x-ch-internal-token {$INTERNAL_AUTH_SERVICE_TOKEN}
        copy_headers x-ch-auth-session x-ch-auth-api-key
    }
    reverse_proxy {$AI_UPSTREAM} { flush_interval -1 }   # AI 串流必須
}

# 新增：過渡相容路徑（dash 切換 Service.AI 後移除）
handle /api/v1/ai/* {
    uri replace /api/v1/ai /ai
    forward_auth {$AUTH_UPSTREAM} { ... 同上 ... }
    reverse_proxy {$AI_UPSTREAM} { flush_interval -1 }
}

# （既有）/api/v1/* → forward_auth → {$SERVICE_UPSTREAM}
```

### 6.2 本地 dev proxy（`apps/gateway` 升級為 workspace app）

```
apps/gateway/
  package.json          # name "gateway"; dev: "bun run --hot dev-proxy/server.ts"
  turbo.json            # persistent dev task
  routes.config.ts      # 路由表單一事實來源（TS）
  dev-proxy/server.ts   # ~120 行 Hono + Bun，port 8787
  caddy/Caddyfile       # 頂部註解「與 ../routes.config.ts 同步維護」
  nginx/                # 既有，不動
```

`routes.config.ts`（Caddyfile 人工對照；codegen 之後有需要再加）：

```ts
export const routes = [
  { prefix: "/auth/internal", block: true },
  { prefix: "/ai/internal", block: true },
  { prefix: "/workflow", block: true },
  { prefix: "/auth", target: "AUTH", port: 3006 },
  {
    prefix: "/api/v1/auth",
    target: "AUTH",
    port: 3006,
    rewrite: ["/api/v1/auth", "/auth"],
  },
  { prefix: "/ai", target: "AI", port: 3007, gate: "optional" },
  {
    prefix: "/api/v1/ai",
    target: "AI",
    port: 3007,
    gate: "optional",
    rewrite: ["/api/v1/ai", "/ai"],
  },
  { prefix: "/api/v1", target: "SERVICE", port: 3005, gate: "optional" },
] as const; // target 可用 DEV_<TARGET>_UPSTREAM 覆寫
```

`dev-proxy/server.ts` 行為（對齊 Caddy 語意）：

1. 剝除 inbound trusted headers（防偽 parity）
2. `block: true` → 404
3. `gate` 路由：`GET http://localhost:3006/auth/internal/gate?mode=optional`（轉送 client 的 `cookie` / `x-ch-api-key`，帶 `x-ch-internal-token`）；204 → 把回傳 trusted headers 疊到 upstream request；401/403 → 原樣回傳 gate response
4. Proxy：`fetch(target + rewrittenPath, { headers: sanitizeHeaders(...), body: c.req.raw.body, redirect: "manual" })` 直接回傳 `Response`——Bun 原生串流直通，AI streaming 零額外處理

Root `package.json` 新增：

```json
"dev:micro":      "turbo run dev --filter gateway... --filter auth... --filter ai... --filter workflow-service... --filter service... --concurrency=20 --continue",
"dev:dash:micro": "turbo run dev --filter dash... --filter gateway... --filter auth... --filter ai... --filter workflow-service... --filter service... --concurrency=25 --continue"
```

本地 env：dash 設 `NEXT_PUBLIC_SERVICE_PROXY_ENDPOINT=http://localhost:8787`（`getServiceUrl` 已支援，零程式改動）；server-side 設 `INTERNAL_AUTH_SERVICE_ENDPOINT=http://localhost:3006`、`INTERNAL_AI_SERVICE_ENDPOINT=http://localhost:3007`、`INTERNAL_WORKFLOW_SERVICE_ENDPOINT=http://localhost:3008`。

## 7. 現有架構可整合重用清單

**直接重用、不需改動：**

| 既有資產                                                                        | 位置                                                       | 用途                                         |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| `createRemoteAuthGateway` / `AuthGatewayApi`                                    | `packages/auth/src/gateway.ts`（branch）                   | `apps/ai` 的 auth 消費                       |
| `encodeTrustedHeader` / `decodeTrustedHeader` / header 常數 / `sanitizeHeaders` | 同上                                                       | ai guards、dev proxy                         |
| `Service.AI` enum + `serviceNameResolver` → `AI_SERVICE`                        | `packages/utils/src/schema`、`config`                      | dash 切換只是 config                         |
| `INTERNAL_AI_SERVICE_ENDPOINT`、`NEXT_PUBLIC_SERVICE_PROXY_ENDPOINT`            | `packages/utils/src/config/env.ts`                         | 已存在，直接用                               |
| internal guard / gate / internal route 模式                                     | `apps/auth/src/guards`、`routes`（branch）                 | ai / workflow 各複製一份（綁各自 token env） |
| `getAuthGateway = once(...)` factory 模式                                       | `apps/service/src/factories/app.factory.ts`（branch）      | `apps/ai` factory                            |
| `rateLimiterGuard`、`bootstrap.ts`、error helpers                               | `apps/service/src`                                         | ai / workflow 各自複用                       |
| Dockerfile `turbo prune --docker` 模式                                          | 根目錄 `Dockerfile.service` 等                             | `Dockerfile.ai` / workflow Dockerfile        |
| CI / Railway config 模式                                                        | `.github/workflows/service-ci.yml`、`infra/railway/*.json` | 各服務複製改 path filter                     |
| `@chia/ai`、`@chia/db` repos、`@chia/kv`、`@chia/api/algolia`                   | packages                                                   | 兩個新服務 in-process 使用                   |

**小幅調整：**

1. `packages/utils/src/schema/index.ts`：加 `Service.Workflow = "workflow"`；`serviceNameResolver` 加 case `"WORKFLOW_SERVICE"`；`config/env.ts` 加 `INTERNAL_WORKFLOW_SERVICE_ENDPOINT`
2. `packages/utils/src/config/index.ts`：`switchServiceVersion` 加 `"ai"` case（比照既有 `"auth"` case）
3. **泛化 trusted-header helpers**：`encodeTrustedHeader` / `decodeTrustedHeader` / `X_CH_*` 常數 / `HOP_BY_HOP_HEADERS` / timing-safe compare 移到 `packages/utils/src/gateway/index.ts`（新 export `@chia/utils/gateway`，零依賴）；`@chia/auth/gateway` re-export 保持相容；auth 專屬的 `AuthGatewayApi` / `createRemoteAuthGateway` 留在原處。不另開 `@chia/gateway-kit` package——此規模不值得
4. **提升 `verifyAuth`**：branch 版（含 trusted-header fast-path）從 `apps/service/src/guards/auth.guard.ts` 提升到 `@chia/auth`（新 export，如 `@chia/auth/middlewares`），service / ai 共用一份
5. **dash 切換**（Phase 4）：`src/services/ai/hooks.ts` 與 `src/resources/ai.resource.ts` 從 `Service.LegacyService` + `/api/v1` 切到 `Service.AI` + `/ai`；`apps/ai/src/server.ts` export `type AIAppRPC` 供 hono-rpc client（type-only 依賴）

## 8. 遷移順序（每階段獨立部署、env var 可回退）

### Phase 0：auth branch 收尾與部署

1. 修 `apps/auth/Dockerfile`：`turbo prune --scope=service` → `--scope=auth`（copy-paste bug），對應 build filter 一併修正
2. `apps/auth/src/server.ts` 綁 `hostname: "::"`（Railway private network 是 IPv6-only）
3. 新增 `.github/workflows/auth-ci.yml`（+ docker-ci，path filter：`apps/auth/**`、`packages/auth/**`）、`infra/railway/auth.json`、`infra/railway/gateway.json`（branch 只加了 Caddy Dockerfile，沒有 Railway config）
4. Railway 部署 auth + gateway（private network；只有 gateway public）；service 設 `INTERNAL_AUTH_SERVICE_ENDPOINT` / `INTERNAL_AUTH_SERVICE_TOKEN`
5. **回退**：unset endpoint → service 回到 in-process auth

### Phase 1：dev proxy + 共用 plumbing（無 production 影響）

1. `apps/gateway` 升級 workspace app：`package.json`、`turbo.json`、`routes.config.ts`、`dev-proxy/server.ts`；root `dev:micro` scripts
2. `@chia/utils/gateway` 抽取 + `@chia/auth/gateway` re-export；`verifyAuth` 提升；`switchServiceVersion` `"ai"` case；`Service.Workflow` enum + env
3. 本地以 dev proxy 端到端驗證 auth 拆分（也是 Phase 2/3 的測試台）

### Phase 2：`apps/ai` 拆分

1. Scaffold `apps/ai`（§3）；搬移 ai.route / ai.guard；`Dockerfile.ai`；`ai-ci.yml`（path filter：`apps/ai/**`、`packages/ai/**`、`packages/auth/**`、`packages/utils/**`）；`infra/railway/ai.json`
2. `apps/service`：移除 `/ai` mount 與 AI 專屬 env / 依賴
3. Caddyfile + `routes.config.ts` 加 `/ai` 與 `/api/v1/ai` handles
4. **部署順序**：ai（private，AI keys）→ gateway（`AI_UPSTREAM`）→ 精簡後的 service
5. **驗收關卡**：`POST /ai/generate`、`POST /ai/content/generate` 經 Caddy 與 dev proxy 兩層實測串流
6. **回退**：redeploy 前版 service image + Caddy 移除 `/ai` handles

### Phase 3：`apps/workflow` 拆分

1. Scaffold `apps/workflow`（§4）；整包搬移 workflows / steps / plugins / nitro workflow module
2. `apps/service`：`feed-indexing.service.ts` 改 HTTP client；**同一版本**移除 workflow module / plugins / 依賴 / `WORKFLOW_*` env（world 單一擁有者約束——不可有過渡期兩邊都掛 world）
3. workflow-ci、Railway config（無 public route；只設 `INTERNAL_WORKFLOW_SERVICE_TOKEN` 與 world env）
4. `service.docker-compose.yaml`：加 workflow container、`WORKFLOW_*` env 移過去
5. **部署順序**：workflow（private，world + embedding keys）→ service 設 `INTERNAL_WORKFLOW_SERVICE_ENDPOINT` / `TOKEN` → 部署精簡後的 service
6. **驗收關卡**：dash 觸發 feed 更新 → service log 顯示 202 + runId → workflow service 完成 indexing（Algolia + embeddings 更新）
7. **回退**：redeploy 前版 service image（含 in-process workflow）並 unset endpoint

### Phase 4：client 切換與清理

1. dash 切 `Service.AI`（§7.5），Vercel redeploy
2. 確認 dash 都走 `/ai/*` 後：刪除 Caddyfile 與 `routes.config.ts` 的 `/api/v1/ai` 過渡 rewrite
3. （可選）feeds query embedding 收斂到 `/ai/internal/embed`，service 徹底移除 AI keys——目前不做（多一跳無收益）

## 9. 風險與評估

| 風險                                           | 評估 / 緩解                                                                                                                                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 共用 Postgres 跨 auth/ai/workflow/service      | 此規模可接受；schema 由 `@chia/db` 單一擁有、migration 跑一次。workflow world 建議放獨立 database/schema 避免 migration 互撞。需要獨立寫入擴展時再另案                                    |
| AI signed-key cookie 跨服務                    | 非問題：path-based routing 下 `/ai/*` 與 `/api/v1/*` 同一個 public host，cookie domain（`getCookieDomain` 取 parent domain）不變。Phase 2 前確認 prod gateway host 在 `chia1104.dev` 之下 |
| 串流過兩層 proxy                               | Caddy 需 `flush_interval -1`；dev proxy 回傳 Response 原生直通；以實測為 Phase 2 驗收關卡                                                                                                 |
| forward_auth 每請求多一跳                      | 換來的是 service 端省掉原本就要做的 getSession；auth 端配 better-auth cookieCache / kv session cache 讓 gate 便宜。可接受                                                                 |
| AI provider keys 存在兩個服務（ai + workflow） | 兩服務拆分的代價；workflow 只配 embedding 最小集合（`OPENAI_API_KEY` 或 `AI_GATEWAY_API_KEY`、`OLLAMA_BASE_URL`），不含 `AI_AUTH_*`                                                       |
| workflow world 單一擁有者                      | Phase 3 步驟 2 強制：service 移除 world 與 workflow service 上線在同一 release，不留過渡期                                                                                                |
| workflow trigger 降級為 warn+skip              | 刻意取捨（§5.3）；`.env.example` 與 code comment 明示，設定缺失可診斷                                                                                                                     |
| Railway 服務數 +3（auth/ai/workflow）          | 個人專案的維運成本上升是本方向的固有代價；以「僅 gateway public、其餘 private」與統一的 CI/Dockerfile 模式壓低邊際成本                                                                    |
| Nitro/Bun 雙 runtime 並存                      | auth/ai 走 Bun compile、workflow/service 走 Nitro——各取所需；若未來 workflow SDK 支援非 Nitro bundler 可再收斂                                                                            |

## 10. 未來（本輪非目標）

- `Service.Content` 拆分（feeds / admin / rpc）——等 legacy service 縮小後評估
- `@chia/workflows` shared package + in-process fallback（需 `npx workflow validate` spike）
- `routes.config.ts` → Caddyfile codegen
- `/ai/internal/embed` 收斂 feeds query embedding
