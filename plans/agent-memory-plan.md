# Writing Agent 長期記憶與自主學習規劃

> 狀態：規劃中，尚未實作
> 建立日期：2026-08-26
> 最後更新：2026-08-27（對照現行程式碼校正：Phase 4 觸發點、reindex 列舉、`MemoryPort` 介面、host hooks/port、路徑與慣例）
> 範圍：`agent.memory` 資料模型、記憶工具（save / search / get）、RAG 索引整合、`fetch_url` 來源自動記錄、session 反思沉澱 workflow、dash 記憶管理頁
> 前置：[`docs/agent-architecture.md`](../docs/agent-architecture.md)、[`docs/rag-architecture.md`](../docs/rag-architecture.md)（皆為現行架構，已實作）

## 0. 執行狀態

| Phase                                             | 狀態      | 備註                                                      |
| ------------------------------------------------- | --------- | --------------------------------------------------------- |
| Phase 1：記得住、搜得到（表 + 工具 + RAG 索引）   | ✅ 完成   | migration `20260826191254_agent_memory`，本機已套用並驗證 |
| Phase 2：自動記錄（source log + volatile 清單）   | ⬜ 未開始 | `fetch_url` 自動留痕；模型看得到本 session 已存了什麼     |
| Phase 3：管理面（oRPC contract + dash 頁）        | ⬜ 未開始 | 記憶可列表、編輯、封存；lesson 審核在這裡落地             |
| Phase 4：自主學習（反思 workflow + lessons 注入） | ⬜ 未開始 | 價值建立在前三期的記憶質量上，刻意放最後                  |

### 主要落點

- Schema：`packages/db/src/schemas/agent.schema.ts`（新增 `agentMemories`）、`packages/db/src/schemas/resources.schema.ts`（`resource_chunk` 加 FK + generated column 改寫）、`schemas/schema.ts` / `relations.ts`（aggregate 匯出）
- Repo：`packages/db/src/libs/agent/memory.ts`（新增；新增 `./repos/agent/memory` export key，見 §4.1）
- 共用寫入邏輯：`packages/api/memories/write.ts`（新增 `./memories/write` export key；仿 `feeds/write.ts`：route 與 agent port 共用「寫入 + 觸發索引」）
- Host hooks / port：`packages/api/orpc/utils.ts`（`BaseOSContext.hooks` 加 `onMemoryChanged`）、`packages/api/orpc/services/memory.service.ts`（`consolidate` port，新增）、`apps/service/src/factories/orpc.factory.ts`（供給兩者）
- RAG adapter：`packages/api/resources/agent-memory.resource.ts`（新增）+ 註冊進 `registry.ts`；`apps/service/src/steps/resource-reindex.step.ts`（`listReindexTargetsStep` 列入記憶，見 §4.8）、`packages/api/orpc/routes/rag.route.ts`（`reindex:all:preview` 的 `targets`）
- 工具：`packages/agent-writing/src/tools/memory.tool.ts`（新增）+ `registry.ts` / `tool-set.ts`（含 `readOnlyToolNames`）/ `summarize.ts` / `types.ts`（`WritingToolContext`、`WRITING_TOOL_TIERS` 註解）/ `ports.ts`
- Port 實作：`apps/service/src/services/agent-memory.port.ts`（新增）；`apps/service/src/agents/writing.ts` 綁進 turn，Phase 4 的觸發也在這裡（§7.1）
- Prompt：`packages/agent-writing/src/prompts/system.ts`（CORE 規則 + volatile context 區塊）
- Client：`packages/agent-elements/src/renderers/memory.tsx`（新增，同 `web.tsx` 的 `ToolRenderers` 形狀）
- Contract / Route：`packages/api/orpc/contracts/memory.contract.ts`、`routes/memory.route.ts`（新增）+ 註冊進 `router.ts` / `router.contract.ts`
- Workflow：`apps/service/src/workflows/memory-consolidation.workflow.ts` + `apps/service/src/steps/memory-consolidation.step.ts`（新增）
- Dash：`apps/dash/src/app/(workspace)/memory/`（新增）+ `shared/routes.tsx`、`components/commons/app-sidebar.tsx`
- Docs：`docs/agent-architecture.md`（+ `.zh.md`）、`docs/rag-architecture.md`（§4.9）

---

## 1. 需求

寫作 agent 目前的一切狀態都以 session 為界：transcript、draft、approval 都是 durable 的，但 session 之間互不相識。同一個主題三週後再寫，agent 會把 `web_search` / `fetch_url` 全部重查一遍；operator 退過的稿、講過的偏好，下個 session 一無所知。

要補的能力有三個，對應三種不同生命週期的記憶：

1. **找資料時同步記錄**：讀過哪些網頁（出處，可重訪）、查證出哪些事實（結論，含來源）。
2. **跨 session 檢索**：寫新文章時能問「我以前查到過什麼」，與「我的部落格寫過什麼」（既有 `search_posts`）是兩個不同的問題。
3. **自主學習**：從 operator 的修改與退稿中沉澱寫作偏好，之後的 session 自動遵守。

### 1.1 設計約束

貫穿整份規劃、優先於任何局部最佳化的四條：

- **不建第二套檢索系統。** 記憶就是一種新的 `ChunkableResource`。`resource_chunk` 的 per-type FK + generated `source_type` 設計、`indexResourceWorkflow` 接受任意已註冊 sourceType，都是為這種擴充留的縫（rag-architecture.md §7）。
- **不動穩定前綴。** 系統提示是 session 內的 cache 前綴，任何會變動的記憶內容只能走兩個合法入口：工具檢索（transcript 留下可見的 tool call）或 volatile context（每個 provider request 重建、永不持久化）。
- **記憶永遠不進公開面。** 記憶 chunk 是 `published: false`，而 `scopeFilter`（`packages/db/src/libs/resources/search.ts`）預設就過濾 `published = true`——公開路徑要讀到記憶必須同時「明確要求 unpublished」且「明確指定 memory sourceType」，兩道都不可能誤觸。
- **每期都是完整可用的產品。** Phase 1 做完 agent 已經記得住也搜得到；自動化與學習是加在能用的東西上面。

## 2. 現況盤點：可直接重用

| 已有                         | 位置                                                                  | 用途                                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Resource adapter registry    | `packages/api/resources/registry.ts`                                  | 註冊 `agent_memory` 後，索引與檢索路徑零改動                                                                           |
| `indexResourceWorkflow`      | `apps/service/src/workflows/resource-index.workflow.ts`               | 已接受任意已註冊 `{sourceType, sourceId}`，就是記憶索引的入口                                                          |
| Chunking / embedding 全管線  | `packages/ai/src/embeddings/`                                         | 記憶 content 是 markdown，`buildChunks` 直接重用既有切分                                                               |
| `searchResources`            | `packages/api/resources/search.ts`                                    | `search_memory` = `sourceTypes: ['agent_memory'], includeUnpublished`                                                  |
| 工具定義與 policy 機制       | `packages/agent-writing/src/tools/schema.ts`、`policy.ts`             | `defineTool` + tier 表；記憶寫入歸 `draft`（免審批），檢索歸 `read`                                                    |
| Port 慣例                    | `packages/agent-writing/src/ports.ts` + `apps/service/src/services/`  | `MemoryPort` 是 `WebPort` / `DraftStore` 的同類 seam                                                                   |
| 共用寫入邏輯的先例           | `packages/api/feeds/write.ts`                                         | 「寫入 + 觸發索引」放一處，route 與 agent port、workflow step 都呼叫它                                                 |
| 便宜旁路模型的先例           | `@chia/agent-runtime/pi/title`（`generateSessionTitle`）              | 反思抽取用 house gateway 的便宜模型，絕不用 session 自己的 BYOK                                                        |
| Transcript 可離線讀          | `agent.session_entry` + `PgSessionStorage`                            | 反思 step 讀 active branch，不需要建 `Agent`                                                                           |
| Durable workflow / step 模式 | `apps/service/src/workflows/`、`src/steps/`                           | consolidation workflow 照抄 feed-indexing 的形狀                                                                       |
| Dash CRUD 頁模式             | `plans/rag-dash-management-plan.md` §1.1 的三條約束                   | client-only oRPC、授權只在 service、dash 不包 API                                                                      |
| In-memory port 測試先例      | `InMemoryDraftStore`（`packages/agent-writing/src/draft/`）           | `InMemoryMemoryPort` 給工具測試用                                                                                      |
| Host port 注入的先例         | `IndexingService`（`packages/api/orpc/services/indexing.service.ts`） | `packages/api` 宣告介面、`apps/service` 在 `createORPCContext` 供給；`memories.consolidate` 要 start workflow 就走這條 |
| Tool card renderer           | `packages/agent-elements/src/renderers/web.tsx`                       | `TOOL_NAMES → ToolRenderers` 的 map；`search_memory` 命中列表照 `FetchUrl` 的形狀做                                    |

## 3. 設計決策

### 3.1 三種記憶 kind，三種生命週期

| kind     | 內容                                                         | 產生方式                                    | 進入模型視野的路徑                      |
| -------- | ------------------------------------------------------------ | ------------------------------------------- | --------------------------------------- |
| `source` | 讀過的網頁：URL、標題、摘錄                                  | `fetch_url` 成功後**自動** upsert，不經模型 | `search_memory` 命中                    |
| `fact`   | 蒸餾過的事實：版本號、API 簽名、基準數據，**必附出處**       | 模型主動呼叫 `save_memory`                  | `search_memory` 命中                    |
| `lesson` | 寫作偏好與教訓：「operator 偏好 X 結構」「這種開頭被退過稿」 | 反思 workflow 抽取，operator 審核後生效     | volatile context 的 digest（always-on） |

分三種是因為它們的信任等級和讀取模式不同。`source` 是確定性的留痕，零模型成本；`fact` 經過模型蒸餾，比存整頁有價值——檢索命中的是結論而不是原文噪音；`lesson` 會改變 agent 行為，所以是唯一需要審核閘門的一種（§3.6），也是唯一 always-on 而非按需檢索的一種（§3.4）。

### 3.2 主鍵是 integer，刻意偏離 agent schema 的 uuidv7 慣例

`agent.session` 用 uuidv7 的理由是「id 會進模型 context 與事件流，必須不可枚舉」。記憶 id 同樣會進 context（`search_memory` 回傳、`get_memory` 接收），但 RAG 管線把型別鎖死了：`resource_chunk.source_id` 是 **integer** generated column，`ChunkableResource.hydrate` 收 `number[]`。兩個選項：

- **integer serial PK（採用）**：可枚舉性只在公開面是風險，而記憶只有 Root tier 的 writing agent 和 admin dash 讀得到，枚舉無利可圖。管線零改動。
- 拓寬 `source_id` 為 text：動到 generated column、unique index、`ChunkHit` / `ResourceHit` / `hydrate` 的每個型別，為一個不存在的威脅付出全管線的代價。不採用。

### 3.3 可見性：`published: false` + 明確 `sourceTypes`，雙防線

記憶 chunk 落表時 `visibility` 固定為 `{ locale: null, published: false, deleted: false }`。效果：

- 所有不帶 `includeUnpublished` 的查詢（公開搜尋、`search_posts` 的 published-only chunk index）天然看不到記憶。
- feed 層呼叫端本來就固定傳 `sourceTypes: [FEED_TRANSLATION_SOURCE_TYPE]`（`packages/api/feeds/search.ts`），是第二道防線。
- `search_memory` 這一個呼叫端明確傳 `sourceTypes: ['agent_memory'], includeUnpublished: true`。

`locale` 留 null：記憶是跨語系的（查資料常是英文、寫文常是中文），不做語系過濾。

### 3.4 記憶怎麼進到模型眼前：三條路，各有明確理由

1. **`search_memory` 工具（fact / source）**——主要路徑。成本顯性（一次呼叫一次檢索），transcript 留下可見的 tool call，operator 看得到 agent 參考了什麼。
2. **volatile context 的「本 session 已存記憶」清單（Phase 2）**——只列本 session 寫入的記憶標題，讓模型知道自己記過什麼、不重複記。一次以 `session_id` 索引的查詢（走 `MemoryPort.listBySession`，`runtime.ts` 只持有 port，見 §4.5），與 `draft.get` 同一風險等級（volatile 讀取失敗會讓 turn 以 `internal` 收場，這是既有的刻意設計，見 agent-architecture.md §4）。
3. **volatile context 的 lessons digest（Phase 4）**——active lessons 的一行式清單。lesson 是行為偏好，必須無條件生效，不能指望模型「想到要去查」；volatile 每個 request 重建、不進 cache 前綴、不累積在 transcript，正是為這種內容設計的位置。上限 20 條（§7.4）。

**刻意不做**：volatile context 內的自動語意檢索（每個 provider request 多一次 embedding 查詢，成本隱形化）；把 lesson 做成 DB-backed 動態 skill（`read_skill` 是按需載入，模型不呼叫就不生效，與 lesson 的語意矛盾——這是對早期構想的修正，skill 適合「做某類任務前要讀的規則」，不適合「永遠要遵守的偏好」）。

### 3.5 Policy tier 歸屬

| 工具            | tier    | 理由                                                                 |
| --------------- | ------- | -------------------------------------------------------------------- |
| `save_memory`   | `draft` | 可逆（dash 可封存/刪除）、不碰 live 內容；免審批讓「順手記錄」零摩擦 |
| `search_memory` | `read`  | 純讀                                                                 |
| `get_memory`    | `read`  | 純讀                                                                 |

`draft` tier 會發 `state:changed`，client 會多一次 draft detail refetch——無害，接受這個代價，不為此新增 tier（tier 是 policy 的詞彙表，多一個詞要有兩個以上的使用者）。`types.ts` 的 `WRITING_TOOL_TIERS` 註解目前寫 `draft` 是「writes to the staging buffer only」，要改成「可逆、對部落格不可見的寫入（staging buffer、記憶）」。`writingTurnBudget` 不動：記憶操作包含在既有的 40 次軟上限內。

### 3.6 Lesson 的信任邊界

長期記憶把 prompt injection 從「污染一個 turn」升級成「污染未來所有 session」的攻擊面：惡意網頁 → transcript → 反思抽取 → lesson → 之後每個 session 的 volatile context。三層緩解：

1. **抽取只看 operator 訊息**：反思 step 送給模型的輸入只包含 `user` 訊息（operator 的原話與修改要求）與 assistant 的總結，**不含 tool result**（網頁內容都在 tool result 裡）。
2. **`lesson` 落地即 `pending`**：volatile digest 只注入 `active`；operator 在 dash 審核後才轉 `active`。單人系統下這一步很輕（看一眼、點一下），換來的是「沒有任何未經人眼的文字能常駐 prompt」這條硬保證。
3. **Provenance 全記錄**：每筆記憶帶 `session_id`（來源 session）與 `source_url`，dash 可回溯。

`fact` / `source` 不需要 pending：它們只在模型主動檢索時進入 context，且 `save_memory` 本身是模型蒸餾過的文字，風險等級與現狀（tool result 直接進 transcript）相同。

## 4. Phase 1：記得住、搜得到

### 4.1 `agent.memory` 表

放在 `agent` Postgres schema（`packages/db/src/schemas/agent.schema.ts`），跟著 `writing_session` 的 extension 慣例：

```ts
agent.memory
├── id            serial PK                    -- integer，理由見 §3.2
├── kind          text: 'source'|'fact'|'lesson'
├── status        text: 'active'|'pending'|'archived'，default 'active'
├── title         text notNull                 -- 一行摘要，volatile 清單與 dash 列表用
├── content       text notNull                 -- markdown；embedding 與 BM25 的輸入
├── sourceUrl     text                         -- source 必填、fact 建議、lesson null
├── sessionId     text FK → agent.session, on delete set null
│                                              -- provenance；session 刪了記憶要留
└── timestamps + softDelete
```

索引：

- `unique (source_url) where kind = 'source' and deleted_at is null` —— `fetch_url` 自動留痕的 upsert 鍵（Phase 2 用，索引先建）。
- `index (session_id)` —— volatile 清單的查詢鍵。
- `index (kind, status)` —— dash 列表與 lessons digest 的查詢鍵。

Repo：`packages/db/src/libs/agent/memory.ts`，以**新的** `./repos/agent/memory` export key 匯出（同 `./repos/feeds/search` 的做法）——`./repos/agent` 指向 `libs/agent/index.ts`，從那裡 re-export 會違反「一 key 一 module、不做 barrel」的慣例。CRUD + `upsertSourceMemory`（§5.1）+ `listBySession` + `listActiveLessons` + `listMemoryIds`（§4.8）。新表同時進 `schemas/schema.ts` 的 aggregate 與 `relations.ts`；`drizzle.config.ts` 的 `tablesFilter` 從 `agent.schema.ts` 自動撈表名，不用另外登記。

### 4.2 `resource_chunk` 加來源：generated column 需要手寫 migration

`packages/db/src/schemas/resources.schema.ts` 按 rag-architecture.md §7 的四步走：

1. 加 `agentMemoryId: integer("agent_memory_id").references(() => agentMemories.id, { onDelete: "cascade" })`（跨 schema FK，Postgres 沒問題）。
2. `CHUNK_SOURCE_COLUMNS` 加 `"agent_memory_id"`（CHECK 自動跟上）。
3. `sourceType` 的 case 運算式加 `when "agent_memory_id" is not null then 'agent_memory'`；`sourceId` 改 `coalesce("feed_translation_id", "agent_memory_id")`。
4. `packages/db/src/libs/resources/chunk.ts` 的 `sourceColumns()` 加一個 branch。

**Migration 注意**：Postgres 不能原地改 generated expression，必須 drop 再 re-add 這兩欄，而它們身上掛著 `resource_chunk_source_kind_index_idx`（unique）、`resource_chunk_source_idx` 與 BM25 索引的兩個 field。drizzle-kit 大概率生不出正確順序，要手寫 SQL：

```
drop BM25 index → drop 兩個 btree index → drop source_type / source_id
→ add agent_memory_id + FK → re-add 兩個 generated column（新運算式，STORED 會自動回填）
→ 重建三個索引 → 改 CHECK
```

`DROP COLUMN source_type` 本身就會連帶把引用它的三個索引丟掉，前兩步的顯式 drop 是為了讓順序可讀，不是必要條件。BM25 索引在現有語料上重建，一次性成本，套用時注意（語料量小，秒級）。

手寫完 migration 後跑一次 `pnpm db:generate` 確認 drizzle-kit 的 diff 為空——schema 定義與資料庫對不上的話，下一個人的 `db:generate` 會再生一份錯的。

### 4.3 RAG adapter

`packages/api/resources/agent-memory.resource.ts`：

- `AGENT_MEMORY_SOURCE_TYPE = "agent_memory"`。
- `buildChunks(db, sourceId)`：讀 memory row，deleted / archived 回 null（chunk 隨之清掉——`syncResourceChunksStep` 對「沒有內容」的語意就是 `deleteResourceChunks`）。card = `kind + title + sourceUrl`（穩定、與長度無關，同 feed card 的設計理由）；sections = 對 `content` 跑既有 chunking。visibility 固定 `{ locale: null, published: false, deleted: false }`。
- `hydrate(db, sourceIds)`：批次讀 title / kind；`href: null`（站上沒有可深連的頁面）。刪除判定與 `buildChunks` 用同一條（deleted 或 archived），守住 rag-architecture.md §6.2 的一致性要求。
- 註冊進 `packages/api/resources/registry.ts`。

### 4.4 共用寫入邏輯：`packages/api/memories/write.ts`

仿 `feeds/write.ts` 的角色：**寫入和觸發索引永遠綁在一起**，route handler（Phase 3）和 agent port（本期）都呼叫它，索引觸發函式當明確參數收（`hooks: MemoryHooks`，必填、同 `feeds/write.ts` 的 `hooks` 語意），不依賴 request context。

`onMemoryChanged` 由 `apps/service` 供給，內容就是 start `indexResourceWorkflow({ sourceType: 'agent_memory', sourceId })`，fire-and-forget（同 `feedHooks` 語意：索引失敗不擋寫入，workflow 自己重試）。兩個呼叫端拿到它的方式不同：

- agent port（`agent-memory.port.ts`）在 workflow step 內建構，沒有 request，直接 import `memoryHooks`（同 `agent-content.port.ts` import `feedHooks`）。
- route handler 從 `context.hooks` 拿：`packages/api/orpc/utils.ts` 的 `BaseOSContext.hooks` 目前只有 `FeedHooks`，要加上 `MemoryHooks`（`onMemoryChanged`），`apps/service/src/factories/orpc.factory.ts` 的 `createORPCContext` 一起 spread 進去。這一步本期就做，Phase 3 的 route 才有東西可拿。

### 4.5 `MemoryPort` 與三個工具

`packages/agent-writing/src/ports.ts` 加：

```ts
export interface MemoryPort {
  save(input: SaveMemoryInput, signal?: AbortSignal): Promise<SavedMemory>;
  search(input: MemorySearchInput, signal?: AbortSignal): Promise<MemoryHit[]>;
  get(id: number, signal?: AbortSignal): Promise<MemoryDetail | null>;
  /** volatile context 用（§5.2）：本 session 寫入的記憶，只要 id / kind / title。 */
  listBySession(sessionId: string): Promise<MemorySummary[]>;
  /** volatile context 用（§7.3）：active lessons 的 title，最多 20 條。 */
  listActiveLessons(limit: number): Promise<MemorySummary[]>;
}
```

五個方法一次定齊，即使後兩個要到 Phase 2 / 4 才有呼叫端：`runtime.ts` 的 `volatileContext` closure 只持有 port（`types.ts` 的設計註解——domain 包不拿 `DB`），§4.1 的 repo 函式從那裡搆不到，所以「volatile 要讀什麼」必須是 port 的一部分。**整個 port 由 host 實作**（不比照 `PgDraftStore` 把 Pg 實作放進 domain 包）：`save` 要 start workflow、`search` 要 `@chia/api/resources/search`，兩者 `agent-writing` 都不該依賴，拆成兩半反而多一個 seam。

`WritingToolContext`（`types.ts`）加 `memory: MemoryPort`；`RunWritingTurnOptions`（`runtime.ts`）加 `memory`；`apps/service/src/agents/writing.ts` 綁 host 實作。`InMemoryMemoryPort`（`packages/agent-writing/src/memory/memory-port.ts`，同 `draft/memory-draft-store.ts` 的角色）實作全部五個方法，`runtime.test.ts` 才跑得過。

`packages/agent-writing/src/tools/memory.tool.ts`：

- **`save_memory`**（draft tier）：`kind`（只開放 `fact`——`source` 是自動的、`lesson` 是 workflow 的，模型都不該手寫）、`title`、`content`（上限 4,000 字元，強制蒸餾而不是倒整頁）、`sourceUrl`（optional 但 description 強烈要求）。回傳 id 與確認訊息。description 要求 API 簽名、型別、指令一律放 code fence：`chunkMarkdown` 會先跑 `cleanMdxKeepStructure`（MDX parse），裸的 `Array<T>` 或 `{ … }` 不是被當 JSX 剝掉就是觸發整段 fallback。
- **`search_memory`**（read tier）：`query`、`limit`（預設 5、上限 10）。Port 實作走 `searchResources({ sourceTypes: ['agent_memory'], includeUnpublished: true, mode: 'hybrid' })`，每筆命中回 memory id、kind、title、bestChunk content（當 snippet）、sourceUrl。
- **`get_memory`**（read tier）：以 id 讀全文，`search_memory` 命中後要細讀時用。

`tools/registry.ts` 加三個 `TOOL_NAMES` + label + tier；`tool-set.ts` 排序放在 retrieval 工具之後、draft 工具之前（read → draft 的既有敘事順序），`readOnlyToolNames()` 也要納入。`summarize.ts` 的 `switch (toolName)` 補三個分支（`Saved memory #42.` / `Searched memory "…" (3 hits).` / `Read memory #42.`）。Client 端 `packages/agent-elements/src/renderers/memory.tsx`：`search_memory` 的命中列表照 `web.tsx` 的 `FetchUrl` / `WebSearch` 做一個 renderer，`save_memory` / `get_memory` 用預設卡片即可。

Host 實作 `apps/service/src/services/agent-memory.port.ts`：`save` 呼叫 `memories/write.ts`（寫入 + 觸發索引），`search` / `get` 走 repo 與 `searchResources`。

### 4.6 Prompt

`prompts/system.ts` 的 CORE 改兩處：

- 「Ground yourself」一步加：動筆前 `search_memory` 一次——過去查證過的事實與讀過的來源都在裡面，省掉重查。
- 「Rules」加一條:查證出的具體事實（版本號、API 簽名、數據）用 `save_memory` 連同出處記下來；記結論，不記原文。

### 4.7 測試

兩個包的測試都在套件根的 `__tests__/`（`packages/api/__tests__/`、`packages/agent-writing/__tests__/`），不在 `src/` 底下。

- Adapter：`packages/api/__tests__/agent-memory-resource.test.ts`——markdown content 的 buildChunks 形狀、archived 回 null、visibility 固定值。
- 寫入：`packages/api/__tests__/memories-write.test.ts`——hooks 參數化（仿 `feeds-write.test.ts`）。
- 工具：`packages/agent-writing/__tests__/memory-tools.test.ts`，用 `InMemoryMemoryPort`（放在 domain 包內，測試與 production 走同一介面）；既有 `runtime.test.ts` 補 `memory` 選項。
- `search_memory` 的 scope 參數（`published: false` + 明確 sourceTypes）用 repo 層測試釘死——這是 §3.3 雙防線的回歸測試。
- Reindex 目標列舉（§4.8）：`listReindexTargetsStep` 的結果同時含 feed translation 與 memory。

### 4.8 全量 reindex 要涵蓋記憶

`listReindexTargetsStep`（`apps/service/src/steps/resource-reindex.step.ts`）目前只列 feed translation，註解本身就寫著第二種 resource type 要在這裡自己列舉。不加的話，下一次 bump `EMBEDDING_INDEX_VERSION` 後 `embeddings:prune` 會把記憶向量全部刪掉，`search_memory` 靜默退化成純 BM25——沒有任何錯誤，只是檢索變差。

- `listReindexTargetsStep` 追加 `listMemoryIds`（未軟刪、未 archived）的 `{ sourceType: 'agent_memory', sourceId }`。
- `rag.route.ts` 的 `reindex:all:preview` 用 `countFeedTranslations` 算 `targets`，要加上記憶數，dash 二次確認的數字才對得上。
- `resourceReindexWorkflow` 本身不動：它對 target 的 sourceType 沒有假設。

### 4.9 文件更新是 Phase 1 的交付項

AGENTS.md 明定 `docs/agent-architecture.md` 與 `docs/rag-architecture.md` 承載 invariant、改動前必讀，所以本期落地時一併更新，不留到最後：

- `rag-architecture.md`：§1 的 resource 表加 `agent_memory`；§2.1 的 chunk 欄位加 `agent_memory_id`；新增一節記「記憶 chunk 固定 `published: false`、`locale: null`，只有 `search_memory` 帶 `includeUnpublished` + 明確 sourceType 讀得到」；§7 的全量 reindex 提 `listReindexTargetsStep` 的列舉義務；§8 檔案地圖加 adapter。
- `agent-architecture.md`（+ `.zh.md`）：§3 資料表加 `agent.memory`；§10 寫 `MemoryPort`、volatile context 多了哪兩段、§3.6 的 lesson 信任邊界；§12 reference 加落點。

## 5. Phase 2：自動記錄

### 5.1 `fetch_url` 自動 source log

`fetchUrlTool.execute` 成功取得頁面後，呼叫 `context.memory.save({ kind: 'source', title: page.title, sourceUrl: page.url, content: 摘錄（前 ~500 字）})`。Port 實作走 repo 的 `upsertSourceMemory`，以 `source_url` upsert（§4.1 的 partial unique index），重訪同一頁更新 title / content / `updated_at`（頁面會變，只更新時間戳會留下過期的摘錄）。

三個實作細節：

- `fetch_url` 是 `executionMode: "parallel"`，同一 URL 兩次平行抓取會在 partial unique index 上撞車。upsert 要用 `onConflictDoUpdate({ target: [sourceUrl], targetWhere: sql\`kind = 'source' and deleted_at is null\` })`——`ON CONFLICT` 的 predicate 必須對得上 partial index，否則 Postgres 找不到可用的 arbiter index。
- key 用去掉 fragment 的 URL（`#section` 不改變頁面），其餘不動——query string 常是內容的一部分，不做更多正規化。
- 重訪不重複觸發索引：`upsertSourceMemory` 回傳 content 是否變動，沒變就不叫 `onMemoryChanged`（`content_hash` 也擋得住重嵌，但一個 workflow run 仍是一次 DB round trip 與一筆 log）。

**失敗語意**：留痕失敗絕不能讓 fetch 失敗——try/catch 包住，吞掉錯誤（Sentry 記一筆）。模型拿到的 tool result 不因留痕與否而不同。

`source` 的 content 只存摘錄不存全文：全文是 cache 的職責不是記憶的職責，而 Firecrawl 重抓一次的成本可接受；記憶要的是「我讀過這個、它大概講什麼、在哪」。

### 5.2 Volatile context：本 session 已存記憶

`buildTurnContext`（`prompts/system.ts`）加一段：

```
- Memories saved this session:
  - [fact] pgvector 0.8 的 iterative_scan 參數（#42）
  - [source] pgvector README（#41）
```

輸入從 `TurnContextInput` 加 `sessionMemories`（`runtime.ts` 的 `volatileContext` closure 裡與 `draft.get` 一起讀，`memory.listBySession` 一次索引查詢）。空清單不輸出該段。這讓模型不重複記、且能直接引用 id 呼叫 `get_memory`。

`source` 的 title 是網頁的 `<title>`，攻擊者可控，而這段每個 provider request 都以 system-ish 的形式出現。模型本來就在 `fetch_url` 的 tool result 看過同一段文字，暴露面不算新，但 `buildTurnContext` 渲染時仍限單行、截到 120 字元——volatile context 是狀態摘要，不是內容的搬運工。`search_memory` 回傳的 title 同樣處理。

## 6. Phase 3：管理面

沿用 `plans/rag-dash-management-plan.md` §1.1 的三條約束：一律 client 端呼叫 oRPC、授權只在 `apps/service`（`adminGuard()`）、dash 不包 API。

### 6.1 Contract / Route

`packages/api/orpc/contracts/memory.contract.ts` + `routes/memory.route.ts`，全部 admin-only（記憶含未發布的研究內容與行為偏好，唯讀路由也不例外，理由同 RAG 管理頁）：

| Procedure                | 內容                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `memories.list`          | cursor 分頁，filter：kind / status / 全文（走 `search_memory` 同款檢索）                                           |
| `memories.get`           | 單筆全文 + provenance（sessionId、sourceUrl）                                                                      |
| `memories.update`        | title / content / status；**內容變更後經 `memories/write.ts` 重觸發索引**                                          |
| `memories.remove`        | 軟刪除；chunk 由 adapter 的 null 語意在下次索引清掉，或直接觸發一次                                                |
| `memories.approveLesson` | `pending → active`（語意上是 `update` 的特化，獨立出來讓審計清楚）                                                 |
| `memories.consolidate`   | 對一個 session 手動啟動反思 workflow（Phase 4 的 §7.1 第二個觸發點；contract 本期先定，route 到 Phase 4 才有實作） |

Route handler 呼叫 repo 與 `memories/write.ts`，不寫 raw Drizzle（既有規範）。`update` / `remove` 的索引重觸發從 `context.hooks.onMemoryChanged` 拿（§4.4 已接好）。

`consolidate` 是唯一要 start workflow 的 route，而 `packages/api` 碰不到 `workflow/api`——走 `IndexingService` 同款的 port 注入：`packages/api/orpc/services/memory.service.ts` 宣告 `MemoryService { consolidate(caller, { sessionId }): Promise<{ runId }> }` 與 `requireMemoryService(context)`（缺席時 `SERVICE_UNAVAILABLE`），`apps/service/src/services/memory-consolidation.service.ts` 實作、`createORPCContext` 掛上 `memory` 欄位。

### 6.2 Dash 頁

`apps/dash/src/app/(workspace)/memory/`：薄殼 + client component（形狀同 feed 管理頁）。列表（kind / status chip、標題、來源連結、時間）、明細抽屜（markdown 預覽、編輯、封存）、pending lessons 置頂待審區。掛進 `shared/routes.tsx` 與 sidebar。

## 7. Phase 4：自主學習

### 7.1 觸發點

兩個，都不是「每 turn 都跑」：

- **執行了 `commit_draft` 的 turn 結束後**：一篇文章落庫是「一個寫作任務完成」的自然邊界，這時 transcript 裡的修改往返最完整。
- **dash 手動觸發**（`memories.consolidate(sessionId)`，§6.1 的 port）：沒有 commit 的 session（純討論、被放棄的方向）也可能有教訓。

第一個觸發點落在 `apps/service/src/agents/writing.ts` 的 `runTurn`，**不是** `ContentPort.commitDraft`。在 port 裡觸發有兩個問題：`createAgentContentPort({ db, adminId })` 沒有 session id；更重要的是它在 turn 進行中——entry 要到 `message_end` 才 append 進 tree（agent-architecture.md §4），`commitDraft` 回傳的當下，commit 的 tool result 與 assistant 的收尾總結都還不在 branch 上，反思 step 讀到的是截斷的 transcript。

做法：`runTurn` 建 content port 時傳一個 `onCommitted` callback（port 在 `commitDraft` 成功後呼叫，翻一個 closure flag），等 `runWritingTurn` resolve 後，`status === "done"` 且 flag 為 true 才 `start(memoryConsolidationWorkflow, [{ sessionId: context.row.id }])`。此時 `runPiTurn` 已把這個 turn 的每個 entry flush 完；approval relay turn 和 `autoApprove: ["commit"]` 兩條路都走同一段程式碼；`error` / `aborted` 的 turn 不觸發。`AgentTurnExecution` 只回 `status` 與 `approvals`，不回哪些工具執行過，所以 flag 是必要的，不是可以從回傳值推出來的東西。

一個 step 內 start 另一個 workflow 是既有做法（`feedHooks.onFeedChanged` 就在 `commitDraft` 裡這麼做）。

### 7.2 `memoryConsolidationWorkflow`

`apps/service/src/workflows/memory-consolidation.workflow.ts`，一個 step：

1. 讀 session 的 active branch（`PgSessionRepo.openById` → `getBranch()` 拿原始 entries，不建 `Agent`——同 maintenance 的原則）。讀**原始 entries** 而不是 `buildBranchContext` 的投影：投影會用 compaction 摘要取代早期訊息，而早期的 operator 修改要求正是要抽的東西；若 `getBranch()` 在 compaction 後只回摘要之後的 entries，改走 `getEntries()` 沿 `parentId` 自己走完。
2. 組抽取輸入：**只有 operator 的 user 訊息與 assistant 的文字回覆，不含 tool result**（§3.6 第 1 層）。退稿理由是訊號最高的輸入，它以 approval relay turn 的 user 訊息存在（`formatOperatorDecision` 合成的文字，`isOperatorDecisionText` 可辨識）——本來就是 user role，只要確認過濾規則不把它當系統文字丟掉。
3. 抽取 prompt 附上現有 active + pending lessons 的標題清單，要求只產出**新的**教訓、上限 3 條、每條一行 title + 兩三句 content——去重在生成端做，不做語意比對（個人規模下夠用，seam 留在這個 step）。
4. 模型走 house gateway 的便宜模型（同 `generateSessionTitle` 的 pattern，絕不用 session 的 BYOK）。
5. 寫入 `kind: 'lesson', status: 'pending', sessionId`，經 `memories/write.ts`（lesson 也要可檢索，operator 在 dash 搜得到）。

模型失敗、抽不出東西都是正常結束（寫 0 筆），不重試到死——lesson 是增益不是正確性需求。

### 7.3 Lessons digest 進 volatile context

`buildTurnContext` 加一段 `# Learned preferences`：active lessons 的 title 一行一條（content 不進 digest；operator 想看全文在 dash）。`TurnContextInput` 加 `lessons`，與 §5.2 的 session memories 同一批讀。

### 7.4 上限與治理

digest 只取最近 20 條 active（`updated_at` 排序）。超過的治理靠 dash 封存——不自動衰減、不打分（§10）。20 條一行式約 600 token，volatile 預算內。

## 8. 風險與 invariant

| #   | 風險 / invariant                                                                     | 對策                                                                                       |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 1   | 記憶洩入公開搜尋                                                                     | §3.3 雙防線 + repo 層回歸測試釘死 scope 參數                                               |
| 2   | 經記憶的持久 prompt injection                                                        | §3.6 三層：抽取不看 tool result、lesson pending-first、provenance 全記錄                   |
| 3   | 系統提示穩定性（cache 前綴）                                                         | 記憶一律走工具或 volatile context，系統提示只加靜態規則文字（session 內不變）              |
| 4   | volatile 讀取失敗 = turn 以 `internal` 失敗（既有刻意設計）                          | 新增的兩個讀取（session memories、lessons）都是單一索引查詢，與 `draft.get` 同風險等級接受 |
| 5   | generated column migration 的 drop/re-add 順序                                       | §4.2 手寫 SQL，索引重建成本一次性且語料量小                                                |
| 6   | `hydrate` 與 `buildChunks` 的刪除判定不一致（命中被 hydrate 丟掉，使用者少看到一筆） | 兩者共用同一個判定函式（deleted 或 archived）                                              |
| 7   | 記憶腐化（過期的 fact、失效的 source）                                               | 個人規模靠 dash 人工整理；`save_memory` 的 4,000 字元上限抑制垃圾量                        |
| 8   | 自動 source log 失敗污染 fetch                                                       | §5.1：吞錯誤 + Sentry，tool result 不受影響                                                |
| 9   | Embedding 成本                                                                       | 個人規模下可忽略；`content_hash` 讓編輯只重嵌變動的 chunk（既有機制）                      |
| 10  | 不需要 bump `EMBEDDING_INDEX_VERSION`                                                | 新增 sourceType 不改前處理與切分策略；記憶內容變更由 `content_hash` 處理                   |
| 11  | 未來 bump index version 後記憶向量被 prune、`search_memory` 靜默退化成 BM25          | §4.8：`listReindexTargetsStep` 列入記憶，測試釘死                                          |
| 12  | 平行 `fetch_url` 同一 URL 在 partial unique index 上撞車                             | §5.1：`onConflictDoUpdate` 帶 `targetWhere` 對上 partial index                             |
| 13  | 反思 step 讀到截斷的 transcript                                                      | §7.1：在 turn 結束後觸發，不在 `commitDraft` 內觸發                                        |

## 9. 測試與驗證

- **單元**：§4.7 的 adapter / 工具 / scope 測試；`memories/write.ts` 的 hook 參數化測試（仿 `feeds/write.ts` 的現有測法）。
- **抽取 prompt**：consolidation step 的輸入組裝（過濾 tool result、附現有 lessons）純函式化，直接單測。
- **檢索品質**：`toolings/scripts/rag-eval` 的 golden query 不含記憶語料，本規劃不動排序邏輯，不需要重跑 baseline；若之後為記憶調 scope 或排序，先跑一次留 baseline（既有規範）。
- **手動驗證路徑**：dev 環境開 writing session → `fetch_url` 一頁 → 確認 source 自動落表且被索引 → `save_memory` 一筆 fact → 開新 session `search_memory` 命中 → dash 列表可見、編輯後重索引 → commit 一篇觸發 consolidation → pending lesson 出現 → 核准後新 turn 的行為遵守。

## 10. 明確不做的事

- **不做記憶衰減 / 打分 / TTL。** 個人規模的治理是 dash 人工整理；要加的時候 seam 在 consolidation step 和 `listActiveLessons` 的排序。
- **不做 volatile context 內的自動語意檢索。** 成本隱形化且每個 request 都付；工具檢索讓成本與意圖都顯性。
- **不做全文網頁快取。** `source` 只存摘錄；重讀走 `fetch_url`。
- **不做跨 kind 的記憶圖譜 / 關聯。** provenance（sessionId、sourceUrl）已經夠回答「這從哪來」。
- **不動 `AgentKindService` 共享 port。** 記憶工具是 writing kind 的 domain 能力（`MemoryPort` 在 `agent-writing`）；第二個 kind 要記憶時再抽到 `agent-content` 旁邊，seam 已經是乾淨的 port。
- **不做 lesson 的自動生效。** pending-first 是安全邊界不是摩擦，見 §3.6。
