# Dash RAG 管理規劃

> 狀態：全部實作完成，migration 尚未套用
> 建立日期：2026-08-12
> 最後更新：2026-08-12
> 範圍：dash 的 embedding 狀態 drawer、獨立 RAG 管理區塊、indexing run 追蹤與觸發權限
> 前置：`docs/rag-architecture.md`（現行架構，已實作）

## 0. 執行狀態

| Phase                                  | 狀態    | 備註                                                        |
| -------------------------------------- | ------- | ----------------------------------------------------------- |
| Phase 0：兩個前置缺口（B/C）           | ✅ 完成 | B 以註解 + `stats.ts` 精確查詢處理；C 由 port 落地 run 紀錄 |
| Phase 1：`resource_index_run` 表       | ✅ 完成 | `20260812083824_resource_index_run`，**migration 尚未套用** |
| Phase 2：port + stats repo + oRPC 路由 | ✅ 完成 | 11 條路由（全 admin-only，見 §5.5）+ 13 個測試              |
| Phase 3：文章編輯區 embedding drawer   | ✅ 完成 | 每語系 chunk 明細 + 觸發 + 輪詢                             |
| Phase 4：RAG 總覽 + chunk explorer     | ✅ 完成 | 總覽 4 張統計卡 + 4 種分佈；explorer 4 個篩選 + 明細抽屜    |
| Phase 5：runs 頁 + 維護動作            | ✅ 完成 | 序列 reindex workflow、二次確認、prune                      |

### 主要落點

- Port 宣告：`packages/api/orpc/indexing.ts`（新增，仿 `packages/api/orpc/agent-runtime.ts`）
- Port 實作：`apps/service/src/services/rag-indexing.service.ts`（新增；原本計畫擴充 `feed-indexing.service.ts`，見 §12）
- 統計查詢：`packages/db/src/libs/resources/stats.ts`（新增）
- 既有 chunk 讀寫：`packages/db/src/libs/resources/chunk.ts`
- Schema：`packages/db/src/schemas/resources.schema.ts`（新增 `resourceIndexRuns`）
- Contract / Route：`packages/api/orpc/contracts/rag.contract.ts`、`packages/api/orpc/routes/rag.route.ts`（新增）+ 註冊進 `router.ts` / `router.contract.ts`
- 全量 workflow：`apps/service/src/workflows/resource-reindex.workflow.ts`（新增）
- Drawer：`apps/dash/src/components/rag/embedding-drawer.tsx`（新增），掛在 `apps/dash/src/components/feed/edit-form.tsx`
- RAG 頁面：`apps/dash/src/app/(workspace)/rag/`（新增）+ `apps/dash/src/shared/routes.tsx`、`components/commons/app-sidebar.tsx`
- Index key 常數：`packages/ai/src/embeddings/utils.ts`（`EMBEDDING_INDEX_VERSION`）

---

## 1. 需求

兩塊 UI，一條權限規則。

1. **文章編輯區**：編輯頁上一個按鈕，點開 drawer 顯示這篇文章當前的 embedding 狀態，並且可以從 drawer 觸發重算。
2. **獨立 RAG 管理區塊**：全部 chunk / embedding 的數據管理與統計資訊。
3. **權限**：所有會觸發 embedding 計算的 API 只有 admin 能呼叫。

### 1.1 設計約束

三條規則，貫穿整份規劃，優先於任何「這樣比較快」的局部最佳化：

- **一律從 client 端呼叫 oRPC。** 不用 RSC 取資料，不用 server action 觸發。所有查詢與 mutation 都在 client component 裡用 `apps/dash/src/libs/orpc/client.ts` 的 `orpc` / `client`，走 `RPCLink` → `apps/service`。RAG 相關的頁面因此都是薄殼 + client component，形狀與 `app/(workspace)/feed/(manage)/posts/page.tsx` 完全相同。
- **授權只在 `apps/service` 驗證。** 唯一的判定點是 oRPC middleware（`adminGuard()`）。`dash` 不重新實作任何權限邏輯 —— 不判 role、不比對 admin id、不做等價的條件渲染判斷。
- **`dash` 不再包一層 API。** 不新增 `app/api/*` route handler、不寫 server action 去代理 oRPC。既有的 `app/api/v1/health/route.ts` 不動。

這三條也決定了 §3.1 的定位、§5.4 的 transport 分類、以及 §6 的按鈕狀態怎麼來。

需求 3 只提到「觸發」要限 admin —— 那個範圍不夠，唯讀路由也必須是 admin-only，理由見 §5.5。

## 2. 現況盤點：可直接重用

| 已有                    | 位置                                                                                        | 用途                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `indexResourceWorkflow` | `apps/service/src/workflows/resource-index.workflow.ts`                                     | 已接受任意 `{sourceType, sourceId}`，就是單一 resource 重算的入口                            |
| `indexResource`         | `apps/service/src/steps/resource-index.step.ts`                                             | 普通組合函式（非 workflow），可在別的 workflow 內迭代而不產生 nested run                     |
| `feedIndexingWorkflow`  | `apps/service/src/workflows/feed-indexing.workflow.ts`                                      | 整篇（含 reading time + 所有語系）                                                           |
| `adminGuard()`          | `packages/api/orpc/guards/admin.guard.ts`                                                   | 預設 role ∈ {admin, root} **且** pin 到 `getAdminId()`，正好符合需求 3                       |
| `rateLimitGuard`        | `packages/api/orpc/guards/rate-limit.guard.ts`                                              | 單一 procedure 的預算                                                                        |
| Port 註冊 pattern       | `packages/api/orpc/agent-runtime.ts` + `apps/service/src/services/agent-runtime.service.ts` | `packages/api` 宣告介面、`apps/service` 在模組載入時註冊實作                                 |
| Run 觀測                | `workflow/api` 的 `getRun()`、`getWorld().runs.list({ workflowName, status })`              | status: `pending/running/completed/failed/cancelled`，另有 `createdAt/startedAt/completedAt` |
| Active run 表的先例     | `packages/db/src/schemas/agent.schema.ts:102`（`agentRuns`）                                | `external_run_id` + partial unique index 做「一個 session 只能一個 active run」              |
| Drawer 寫法             | `apps/dash/src/components/assets/file-tree-drawer.tsx`                                      | heroui `Drawer.Backdrop/Content/Dialog/Body`                                                 |
| `hasEmbedding` 已上 UI  | `apps/dash/src/components/feed/meta-chip.tsx`                                               | drawer 按鈕的掛點                                                                            |
| Cursor 形狀             | `packages/api/orpc/contracts/shared.ts`（`withMetaSchema`）                                 | chunk explorer 分頁沿用                                                                      |

## 3. Phase 0：兩個必須先修的缺口（B、C）

§1.1 的第一條約束已經把缺口 A 從「阻塞前置」變成「防呆」，所以 Phase 0 只剩 B 和 C。A 的內容移到 §3.1 記錄原因，實作併入 Phase 2。

### 3.1 缺口 A（已降級為防呆）— router 在 dash 進程裡沒有 workflow runtime

`apps/dash/src/libs/orpc/client.rsc.ts` 用 `createRouterClient(router)` 把同一份 router 跑在 Next 進程裡（由 `app/layout.tsx` 與 `instrumentation.ts` 匯入）。但 `registerFeedEventListeners` 只在 `apps/service/src/routes/rpc.route.ts` 註冊，workflow runtime 也只存在於 `apps/service`。

在那個進程裡，`packages/api/orpc/events.ts` 的 `listeners.onFeedChanged?.(feedID)` 會**靜默 no-op** —— 呼叫端看到成功但什麼都沒發生。

§1.1 規定一律從 client 端呼叫，所以這條路徑本來就不會被走到。但仍然要做一件事：**port 未註冊時丟 `SERVICE_UNAVAILABLE`**，不要沿用現有 event 的 `?.()` 靜默語意。理由是讓誤用立刻失敗 —— 將來若有人不小心在 RSC 裡呼叫，得到的是一個明確的錯誤，而不是一個假成功。成本是一個 if，隨 Phase 2 的 port 一起做。

現有 feed event 的靜默是合理的（fire-and-forget 的副作用）；新的觸發 port 不是，因為有人在等回饋。

### 3.2 缺口 B — `hasEmbedding` 沒有比對 model / index_version

`packages/db/src/libs/feeds/index.ts:235` 與 `:341` 的 exists 子查詢只 join `e.chunk_id = c.id`，沒有 `e.model = ? and e.index_version = ?`。

結果：bump `EMBEDDING_INDEX_VERSION` 或換 provider 之後，UI 仍顯示「已嵌入」，但那些向量在當前 index key 下等於不存在（`listChunksNeedingEmbedding` 會把它們算成 backlog）。

處理：新增精確查詢，把狀態分成三態：

| 狀態      | 判定                                                  |
| --------- | ----------------------------------------------------- |
| `current` | 有 (chunk_id, model, index_version) = 當前 key 的向量 |
| `stale`   | 有向量但 key 不是當前的                               |
| `missing` | 完全沒有向量                                          |
| `absent`  | 連 chunk 都沒有（沒有內容，或還沒索引過）             |

Drawer 與 RAG 統計都用這個。`meta-chip.tsx` 的 chip 是否一併改語意可以另外決定 —— chip 只有一個 icon 的空間，維持「曾經嵌入過」也還算誠實，但 drawer 必須精確。

### 3.3 缺口 C — run handle 被丟掉

`apps/service/src/services/feed-indexing.service.ts` 的 `syncFeedSearchIndex` 有回傳 `start()` 的 `Run`，但 `rpc.route.ts` 的 listener 直接丟棄。要在 drawer 顯示進度，runId 必須交回呼叫端並落地。

### 3.4 順帶修正：文件與現況不符

`docs/rag-architecture.md` §9 寫「兩個沒接線的函式：`pruneStaleEmbeddings`（`chunk.ts`）和 `buildIndexKey`（`provider.ts`）」。實際上 `pruneStaleEmbeddings` **根本不存在**（grep 全 repo 只有 `packages/ai/src/embeddings/provider.ts:111` 的 `buildIndexKey`）。Phase 5 的「清理舊向量」要從零寫，順手更新這段文件。

---

## 4. Phase 1：`resource_index_run`

放在 `packages/db/src/schemas/resources.schema.ts`，緊接 `resourceEmbeddings`。

```
chia_resource_index_run
├── id                bigserial PK
├── external_run_id   text NOT NULL   -- workflow runtime 的 runId
├── scope             text NOT NULL   -- 'resource' | 'feed' | 'all'
├── source_type       text            -- scope='resource' 時有值
├── source_id         integer
├── feed_id           integer FK → chia_feed (ON DELETE SET NULL)
├── status            text NOT NULL DEFAULT 'pending'
│                     -- pending | running | completed | failed | cancelled
├── triggered_by      text FK → chia_user   -- 誰按的（審計）
├── model             text NOT NULL   -- 這次用的 provider id
├── index_version     text NOT NULL
├── progress          jsonb           -- { done, total, failed: number[] }，全量用
├── result            jsonb           -- ResourceIndexResult
├── error             text
├── started_at / ended_at
└── created_at / updated_at
```

索引：

```sql
-- 查詢：某個 resource 的歷史
index on (source_type, source_id)
-- 對照 workflow runtime
index on (external_run_id)
-- 防重複觸發（三個 scope 各一）
unique (source_type, source_id) where scope = 'resource' and status in ('pending','running')
unique (feed_id)                where scope = 'feed'     and status in ('pending','running')
unique (scope)                  where scope = 'all'      and status in ('pending','running')
```

`feed_id` 用 `ON DELETE SET NULL` 而不是 cascade：feed 被硬刪之後，「曾經對它跑過 reindex」這件事對維護頁仍有意義。`source_id` 沒有 FK（`resource_chunk` 的 `source_id` 是 generated column，不是可參照的 key），所以孤兒 row 靠 scope 語意判讀，不靠外鍵。

### 4.1 狀態收斂：必須雙軌

Partial unique index 會被孤兒 row 永久卡住 —— workflow 進程 crash 或 run 被 cancel 時 `status` 停在 `running`，之後任何觸發都撞 unique 衝突，使用者只會看到一個講 Postgres constraint 的錯誤。

所以兩條路都要有：

1. **workflow 尾端的 finalize step** 寫回 `status` / `result` / `ended_at`。happy path 即時。
2. **讀取時 lazy reconcile**：任何回傳 active run 的路由，先拿 `external_run_id` 去問 `getRun().status`，發現 workflow 已經 terminal 就把 DB row 補正再回傳。

`agent_run` 那邊只有第 1 條，但 agent 的 active run 有 abort 路徑可以手動清；這裡使用者會反覆按同一顆按鈕，卡住的成本高得多，所以第 2 條不是可選項。

觸發路由撞到 active run 時的行為：**回傳現有的 run（含 runId）而不是報錯**，前端直接接上輪詢。這比「已有任務進行中」的錯誤訊息有用。

---

## 5. Phase 2：後端

### 5.1 Port 宣告 — `packages/api/orpc/indexing.ts`

`packages/api` 不能 depend on `workflow`（那是 host app 的執行環境），所以宣告介面、由 `apps/service` 註冊實作。介面形狀：

```ts
interface IndexingService {
  indexResource(caller, { sourceType, sourceId }): Promise<IndexRunHandle>;
  indexFeed(caller, { feedId }): Promise<IndexRunHandle>;
  reindexAll(caller, { onlyMissing }): Promise<IndexRunHandle>;
  getRunStatus(runId): Promise<IndexRunStatus | null>;
}
```

`caller` 帶 `adminId` / `userId`（已由 `adminGuard` 驗過），供 `triggered_by` 落地。未註冊時所有方法丟 `SERVICE_UNAVAILABLE`（§3.1）。

`IndexRunHandle` 回傳 `{ runId, recordId, status, reused: boolean }` —— `reused` 讓前端知道這是接上既有的 run 而不是新開的。

### 5.2 統計查詢 — `packages/db/src/libs/resources/stats.ts`

全部用 `withDTO` 包，與 `chunk.ts` / `search.ts` 一致。

| 函式                                                      | 供給                                                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `getResourceIndexStatus({ ref, model, indexVersion })`    | drawer 的 chunk 明細：kind / chunkIndex / headingPath / tokenCount / `current\|stale\|missing` / updatedAt |
| `countResourceIndexStatus({ refs, model, indexVersion })` | 一篇文章的多語系一次查完（避免 N+1）                                                                       |
| `getRagOverview({ model, indexVersion })`                 | 總覽：chunks / current / stale / missing 總數，並 group by sourceType、locale、kind、published+deleted     |
| `listChunks({ filters, cursor, limit })`                  | explorer 分頁。`content` 只回截斷預覽                                                                      |
| `getChunkDetail({ chunkId })`                             | explorer 的明細抽屜：全文 + metadata + 向量存在與否                                                        |
| `getEmbeddingKeyDistribution()`                           | group by (model, index_version) 的向量筆數 —— 看得出有多少舊 key 的殘留                                    |
| `countChunksNeedingEmbedding({ model, indexVersion })`    | 純 count；現有 `listChunksNeedingEmbedding` 只回 rows，統計不該把 rows 拉出來                              |
| `deleteStaleEmbeddings({ model, indexVersion })`          | 維護：刪掉非當前 key 的向量                                                                                |

`listChunks` 的 `content` 一定要截斷。chunk 目標大小是 512 token，一頁 50 筆就是可觀的 payload，而列表只需要辨識用的開頭。

### 5.3 Contract / Route

新增 `packages/api/orpc/contracts/rag.contract.ts` 與 `routes/rag.route.ts`，並註冊進 `router.ts` 與 `router.contract.ts`（兩邊都要，命名沿用現有的 `"a:b"` 風格）。

**11 條路由全部是 `adminGuard()`，唯讀也一樣。** 原本的設計把唯讀路由定成 `authGuard`，那是錯的，理由見 §5.5。

| 路由                         | 守衛                              | 說明                                          |
| ---------------------------- | --------------------------------- | --------------------------------------------- |
| `rag.overview`               | `adminGuard()`                    | 統計卡                                        |
| `rag["chunks:list"]`         | `adminGuard()`                    | explorer                                      |
| `rag["chunk:get"]`           | `adminGuard()`                    | chunk 明細                                    |
| `rag["resource:status"]`     | `adminGuard()`                    | drawer 主查詢                                 |
| `rag["runs:list"]`           | `adminGuard()`                    | runs 頁。含 lazy reconcile → service-only     |
| `rag["run:get"]`             | `adminGuard()`                    | drawer 輪詢。含 lazy reconcile → service-only |
| `rag["reindex:all:preview"]` | `adminGuard()`                    | 二次確認要顯示的數字                          |
| `rag["resource:index"]`      | `adminGuard()` + `rateLimitGuard` | 單一 resource 重算                            |
| `rag["feed:index"]`          | `adminGuard()` + `rateLimitGuard` | 整篇重算                                      |
| `rag["reindex:all"]`         | `adminGuard()` + `rateLimitGuard` | 全量                                          |
| `rag["embeddings:prune"]`    | `adminGuard()` + `rateLimitGuard` | 清理舊 index key 的向量                       |

四個寫入路由都是 mutation。`sourceType` 用 `isResourceType` refine，和 `resourceIndexRequestSchema`（`apps/service/src/workflows/resource-index.workflow.ts`）一致 —— 在邊界擋掉壞值，不要讓它變成一個重試到失敗的 workflow run。

`rateLimitGuard` 的 prefix 分開：`rate-limiter:rag-index`（單篇，可以寬鬆）與 `rate-limiter:rag-bulk`（全量與 prune，要很緊）。

### 5.4 呼叫方式

**全部 11 條路由都從 client component 呼叫**，走 `apps/dash/src/libs/orpc/client.ts` 的 `orpc`（query / mutation）→ `RPCLink` → `apps/service` 的 `/api/v1/rpc`。沒有例外，見 §1.1。

`apps/dash/src/libs/orpc/client.rsc.ts` 的 in-process router 在整個 RAG 功能裡不參與。這不只是風格統一 —— 觸發類路由需要 `start()`、`run:get` / `runs:list` 的 lazy reconcile 需要 `getRun()`，兩者都只存在於 `apps/service`；而讓純統計路由也走同一條路，換來的是「每條路由只有一種執行環境」，不必為了 RSC 與 browser 的差異各驗一次。

連帶影響：

- RAG 頁面沒有首屏預取，需要 loading 狀態。沿用 `apps/dash/src/components/feed/skeleton.tsx` 與 `app/(workspace)/feed/(manage)/posts/loading.tsx` 的慣例。
- 頁面本身是薄殼（`page.tsx` 只組合 client component 並傳 query 參數），與 `posts/page.tsx` 相同。
- 列表用 `useInfiniteQuery`，抄 `apps/dash/src/components/feed/feed-list.tsx`。

### 5.5 為什麼唯讀路由也必須是 admin-only

原本的設計只要求「觸發 embedding 的 api 限 admin」（需求 3），唯讀路由因此定成 `authGuard`。那是一個資源歸屬層級的漏洞：

- `authGuard` = `sessionPolicy()`，只檢查有沒有登入，任何 role 都通過（`packages/service-kit/src/policies/session.policy.ts`）。
- 註冊是開放的：`packages/auth/src/base-auth.ts` 有 GitHub / Google OAuth 與 magic link，沒有 `disableSignUp`，新使用者 `role` 預設 `Role.User`。
- `resource_chunk` 存的是每個被索引資源的**正文**，而且沒有任何歸屬欄位可以過濾。`stats.ts` 的查詢也刻意**不**過濾 `published` / `deleted` —— 管理介面本來就要看得到草稿與已下架的內容。

三者相加：任何能收信的人都能登入後呼叫 `rag["chunks:list"]` 分頁列舉全部 chunk、用 `query` 參數做 `ILIKE` 全文搜尋，再用 `rag["chunk:get"]` 取完整內文，包含其他使用者未發佈的草稿。對照 `feeds.list` 有 `whereAnd: { userId: session.user.id }`，可見這個 app 的意圖確實是 feed 屬於個別使用者。

所以 11 條路由一律 `adminGuard()`（role ∈ {admin, root} 且 pin 到 `getAdminId()`）。pin 到單一 admin 是正確的範圍：公開站台服務的就是那一位作者的 feed，corpus 本來就屬於他。

**連帶移除 `canTrigger`。** 既然讀取所需的權限與觸發相同，「能讀到資料」本身就是權限訊號，`dash` 用 `!!data` 決定按鈕狀態即可，不需要伺服器再回一個布林值，`adminIdGuard` 也不再需要。§1.1 的第二條約束更嚴格地成立了：`dash` 連一個權限布林值都不用消費。

代價：非 admin 進 RAG 頁會看到 `FORBIDDEN` 訊息而不是被隱藏的側邊欄項目 —— §1.1 不准 `dash` 判權限，所以導覽不會自動隱藏。

---

## 6. Phase 3：文章編輯區 drawer

新增 `apps/dash/src/components/rag/embedding-drawer.tsx`，掛在 `apps/dash/src/components/feed/edit-form.tsx` 的 header、`MetaChip` 旁邊。

heroui `Drawer.*`，抄 `apps/dash/src/components/assets/file-tree-drawer.tsx` 的結構。內容：

- **頂部**：model、`EMBEDDING_INDEX_VERSION`、整體覆蓋率（`@chia/ui/progress`）、上次 indexing 完成時間
- **每個 locale 一段**：chunk 表格 —— kind（card / section）、chunkIndex、headingPath、tokenCount、狀態圓點（current / stale / missing）。card 與 section 分開列，因為它們的用途不同（card 餵相關文章、section 餵搜尋）
- **底部**：`重新計算此語系` / `重算整篇`。disabled 與否綁在 `rag["resource:status"]` 是否載到資料上 —— 讀得到就代表有權限（§5.5），dash 不自己判 role
- **輪詢**：mutation 回傳 `{ runId }` → `rag["run:get"]` 加 `refetchInterval`，status 進入 completed / failed / cancelled 就停止輪詢並 invalidate `rag["resource:status"]`

整個 drawer 是 client component，所有查詢與 mutation 都走 `orpc`（§1.1 / §5.4），沒有 RSC 預取也沒有 server action。

注意 `packages/db/src/libs/feeds/index.ts` 的 `getFeedDetails` 有 `$withCache({ ex: 300 })`，reindex 後回到列表可能看到舊的 `hasEmbedding`。drawer 自己的查詢不要走 cache。

## 7. Phase 4：RAG 管理區塊

```
apps/dash/src/app/(workspace)/rag/page.tsx              總覽
apps/dash/src/app/(workspace)/rag/chunks/page.tsx       chunk explorer
apps/dash/src/app/(workspace)/rag/runs/page.tsx         indexing runs
apps/dash/src/app/(workspace)/rag/maintenance/page.tsx  維護動作
```

四個 `page.tsx` 都是薄殼，實際內容在 `apps/dash/src/components/rag/` 下的 client component（§5.4）。

`apps/dash/src/shared/routes.tsx` 加一個 `rag` group（使用者要的是「獨立的區塊」，所以不塞在 Content 底下），`components/commons/app-sidebar.tsx` 加 `<NavMain title="RAG" items={routeItems.rag} />`。

- **總覽**：統計卡（chunks / current / stale / missing）+ 分佈（sourceType、locale、kind、(model, index_version)）。client 端 `orpc.rag.overview` 取，配 skeleton。
- **explorer**：篩選 sourceType / locale / kind / 嵌入狀態，可搜尋 content。點一列開明細。分頁用 `withMetaSchema` 的 cursor + `useInfiniteQuery`。
- **runs**：近期 run 列表（scope、目標、狀態、耗時、觸發者、progress）。有 active run 時加 `refetchInterval`。
- **維護**：顯示當前 index key、`清理舊向量`、`補齊缺漏`、`全量 reindex`。三顆按鈕都要二次確認（含 prune），disabled 綁在 `rag.overview` 是否載到資料上。

## 8. Phase 5：全量 reindex

新增 `apps/service/src/workflows/resource-reindex.workflow.ts`。**不重用 `feedIndexingWorkflow`** —— 那個還會算 reading time，而且一篇一個 run 會讓進度追蹤變成聚合 N 個 run 的問題。改成扁平序列：

```
listTranslationIdsForReindexStep()          → 所有 feed_translation.id
for (const sourceId of ids) {               // 序列，不 fan-out
  try { await indexResource({ sourceType: 'feed_translation', sourceId }) }
  catch { failed.push(sourceId) }
  await recordReindexProgressStep({ recordId, done, total, failed })
}
finalizeReindexRunStep()
```

`indexResource` 本來就是普通組合函式而非 workflow（`docs/rag-architecture.md` §3.2 的理由：讓已經在 workflow 裡的呼叫端重用而不產生 nested run），正好適合這裡的序列迭代。

序列而非 fan-out 是刻意的：`embedPendingChunksStep` 每輪打 32 筆，N 篇同時跑會一起打 OpenAI，撞 rate limit 之後靠 step 重試反而更慢，而且費用尖峰不可控。

每篇寫一次 `progress` 到 DB，相對 embedding 呼叫的成本可以忽略，換來維護頁能顯示 `123/456` 與失敗清單。

**二次確認**：`rag["reindex:all:preview"]` 回傳 translation 數、chunk 總數、當前 index key 下待嵌入的 chunk 數。modal 顯示這三個數字後才允許確認。

`onlyMissing` 參數區分兩種語意：

| 動作         | `onlyMissing` | 行為                                                                     |
| ------------ | ------------- | ------------------------------------------------------------------------ |
| 補齊缺漏     | `true`        | 不重寫 chunk，只把 missing / stale 的向量補上。費用可預測                |
| 全量 reindex | `false`       | 走完整的 `indexResource`（重建 chunk 再補向量）。bump index version 後用 |

---

## 9. 風險與成本

- **費用**：單篇觸發沒問題（`embedPendingChunksStep` 是 drain loop，一次 32 筆）。風險全在全量 —— 序列 workflow + 二次確認 + `rate-limiter:rag-bulk` 三層防護。
- **孤兒 active row 卡死觸發**：見 §4.1，lazy reconcile 是必要的而非 nice-to-have。
- **誤用 in-process router**：見 §3.1。§1.1 規定不從 RSC 呼叫，但 port 未註冊仍要丟錯，讓將來的誤用立刻失敗。
- **快取**：`getFeedDetails` 的 300 秒 cache 會讓 reindex 後的列表顯示舊狀態。
- **全 client 的首屏成本**：RAG 頁面沒有預取，首次進入會看到 skeleton 再填資料。這是 §1.1 換來執行環境單一化的代價，與 `posts` 頁現況一致。
- **payload**：explorer 的 `content` 必須截斷。
- **`stale` 的判定成本**：三態判定需要對 `resource_embedding` 做 anti-join + key 比對。目前語料規模（約 42 translations / 289 embeddings）完全不是問題，但 explorer 的篩選要走索引；`resource_embedding` 的 PK 是 `(chunk_id, model)`，`index_version` 不在索引裡，若之後資料量大需要補一個 `(model, index_version)` 的索引。

## 10. 驗收

- Phase 0：bump `EMBEDDING_INDEX_VERSION` 後，drawer 顯示 `stale` 而不是「已嵌入」。
- Phase 1：連按兩次「重新計算」，第二次回傳同一個 runId 且 `reused: true`；手動把 run 的 DB status 改成 `running` 再觸發，lazy reconcile 能自動補正而不是撞 unique 衝突。
- Phase 2：`apps/dash` 全域 grep 不到 `getAdminId`、`Role.Admin`、`session.user.role`，也沒有新增的 `app/api/*` 或 server action —— 驗證 §1.1 的後兩條約束沒有被繞過；port 未註冊時觸發路由回 `SERVICE_UNAVAILABLE`。
- Phase 3：非 admin 帳號呼叫**任何一條** rag 路由（唯讀也算）都得到 `FORBIDDEN`；admin 觸發後 drawer 的進度會自己走完並刷新明細。
- Phase 5：`onlyMissing: true` 不改變任何 chunk 的 `content_hash`。

## 11. 未決

- `meta-chip.tsx` 的 chip 是否改用三態語意（空間只有一個 icon）。目前維持「曾經嵌入過」。
- 檢索品質基準（`docs/rag-architecture.md` §9 的第一項）不在本規劃範圍。RAG 管理區塊將來是放評測結果的自然位置，但要先有評測腳本。
- `resource_index_run` 的保留期限 / 清理策略。目前資料量小，暫不處理。
- **`feeds` 詳情路由缺 userId scope**（既有問題，見 §12）。
- **跨 scope 不互斥**：`resource` 與 `feed` 兩個 scope 各有自己的 active unique index，所以「重算此語系」與「重算整篇」可以同時在跑，同一批 chunk 會被嵌入兩次。資料不會壞（`saveChunkEmbeddings` 是 upsert），但會多花額度。要擋需要跨 scope 的鎖，先不做。
- `docs/rag-architecture.md` §9 關於 `pruneStaleEmbeddings` 的描述仍待更新（見 §3.4）。

---

## 12. 實作紀錄

### 與計劃不同的決定

1. **Port 實作放在新檔 `apps/service/src/services/rag-indexing.service.ts`**，而非擴充 `feed-indexing.service.ts`。形狀對齊 `agent-runtime.service.ts` 的先例，`feed-indexing.service.ts` 完全未動。
2. **Run bookkeeping 的 step 放在新檔 `resource-reindex.step.ts`**，而非擴充 `resource-index.step.ts` —— 後者也在 feed-event 路徑上，那條路徑沒有 `resource_index_run` 列可寫。
3. **§4.1 的雙軌，單篇/單篇 feed 只有第 2 條。** `resource` 與 `feed` scope 沿用既有的 `indexResourceWorkflow` / `feedIndexingWorkflow`（與 feed-event 共用，那條路徑沒有 run 列），所以沒有尾端 finalize step，收斂全靠讀取端的 reconcile，`result` 由 reconcile 從 `run.returnValue` 落地。只有 bulk workflow 兩條都有。drawer 本來就在輪詢 `run:get`，對 UI 而言 happy path 仍是即時的。
4. **缺口 B 不改 `hasEmbedding` 的查詢語意**，只在兩處加註解。把 index key 穿進 `getInfiniteFeeds` / `getFeedDetails` 太侵入，精確狀態改由 `stats.ts` 供給（§3.2 本來就允許 chip 維持舊語意）。
5. **`chunks:list` 的 `nextCursor` 收窄成 `number`**，覆寫 `withMetaSchema` 的 `string | number`。這個 cursor 是 chunk id，輸入端只收 number，不收窄會逼每個呼叫端在回程手動轉型。
6. **`reindex:all:preview` 補了 `targets`**（translation 數）。原本只有 chunk 總數與待嵌入數，缺 §8 二次確認要求的第一個數字。
7. **`packages/db` 多了兩個 repo 函式**：`listFeedTranslationIds`（bulk workflow 列舉目標，升序、不過濾，未發佈與軟刪也重算，讓 chunk 的可見性鏡像保持同步）與 `countFeedTranslations`（preview 用）。無 schema 變更。

### 事後修正：唯讀路由的資源歸屬漏洞

初版把 7 條唯讀路由定成 `authGuard`，等於「登入即可讀取全站 chunk 正文（含他人草稿）並全文搜尋」。完整分析與修法見 §5.5。這是規劃階段的疏漏 —— 需求只寫了「觸發限 admin」，我照抄成守衛表時沒有問「讀取要不要保護」。

修正後 11 條路由一律 `adminGuard()`，`canTrigger` 與 `adminIdGuard` 一併移除，並補上 6 條測試斷言「signed-in 非 admin 對每一條唯讀路由都得到 `FORBIDDEN`」。

同時記錄一個**未處理的既有問題**：`feeds["details-by-id"]` 與 `["details-by-slug"]`（`packages/api/orpc/routes/feeds.route.ts`）也只有 `authGuard`、還帶 `enableDeleted: true`，所以「知道 id 或 slug 就能讀他人草稿」在這個 PR 之前就存在。刻意不在此 PR 一起改：那條路徑 dash 編輯頁正在使用，改動範圍與風險都超出這次的題目。

### 額外加固：`reconcile` 的 60 秒寬限期

`start()` 可能在 run 還沒被 world 記錄時就回傳 —— creation event 失敗但 queue 已接受時，SDK 會設 `resilientStart` 並由 runtime 非同步重建紀錄。那個窗口內 `run.exists` 是 `false`，但 run 其實即將執行。

原本的 `reconcile` 會立刻把它 finalize 成 `failed`，同時**釋放 active partial unique index** —— 操作者看到假失敗、再按一次，就有第二個 run 對同一批 chunk 重複嵌入。

現在 `exists === false` 只有在該列已存在超過 `MISSING_RUN_GRACE_MS`（60 秒）時才判定為死亡。代價是真正消失的 run 最多顯示 60 秒的 `running`。

### 驗證結果

- `pnpm type:check` 19/19、`pnpm test` 320 passed / 2 skipped、`pnpm lint` 於 `dash` / `api` / `db` / `service` 皆 0 warning。
- `apps/service` 的 `pnpm build` 通過，且 bundle 內確認 `resourceReindexWorkflow` 與 4 個 step 都被 `"use workflow"` / `"use step"` 轉換註冊。
- §1.1 三條約束以 grep 驗證：`apps/dash` 的 RAG 程式碼內完全沒有 `getAdminId` / `Role.*` / `session`，沒有新增 `app/api/*`，沒有 server action，RAG 頁面不使用 in-process client。
- `stats.ts` 的三態判定與 `index-run.ts` 的三個 partial unique index 曾在一次性的 Postgres 18 叢集上實測（`/tmp`，用完刪除，未接觸專案資料庫）：三態計數、狀態篩選、cursor 分頁、重複 claim 回 `reused: true`、finalize 後可再 claim，全部符合預期。

### 尚未執行

**migration 未套用。** `packages/db/.drizzle/migrations/20260812083824_resource_index_run/` 已產生但沒有跑 `db:migrate` / `db:push`。在套用之前，所有觸發與 runs 頁都會因為 `chia_resource_index_run` 不存在而失敗；唯讀的 chunk 統計不受影響。
