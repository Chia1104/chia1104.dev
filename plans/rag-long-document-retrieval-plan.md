# RAG 長文索引與 Chunkless 檢索規劃

> 狀態：全部未開始（ParadeDB 遷移前置已完成）
> 建立日期：2026-08-10
> 最後更新：2026-08-10
> 範圍：embedding token 上限、document-level 向量表示、檢索聚合與 hybrid、full-document context 注入
> 前置：[rag-optimization-plan.md](./rag-optimization-plan.md)（Phase 0–3 已實作，Phase 4 評測未開始）

## 0. 執行狀態

| Phase                              | 狀態      | 備註                                                       |
| ---------------------------------- | --------- | ---------------------------------------------------------- |
| Phase 0：token 計數與批次正確性    | ⬜ 未開始 | 修 `maximum input length is 8192 tokens`，無 schema 變更   |
| Phase 1：document 向量改為文件卡   | ⬜ 未開始 | summary + heading outline；bump `index_version` 全量重嵌   |
| Phase 2：長文多向量 document       | ⬜ 未開始 | `kind="document"` 多列，沿用既有 unique index，無 migration |
| Phase 3：檢索聚合與三路容錯        | ⬜ 未開始 | top-3 平均取代單一 max；`allSettled` 多路                  |
| Phase 4：in-DB BM25（ParadeDB）    | 🔶 前置完成 | **已定案採用**；tokenizer（4.4）與 Drizzle 工具鏈（4.3.1）皆已實測驗證 |
| Phase 5：Chunkless context 注入    | ⬜ 未開始 | 全文 hydration + token budget + heading 定位 citation      |

### 執行環境（ParadeDB）

已完成（local）：

- `db.docker-compose.yaml` 換為 `paradedb/paradedb:pg18`，container `chia-paradedb`、volume `chia-paradedb`、`PGDATA=/var/lib/postgresql/data/paradedb`。port `5434` 不變，連線字串不需改。
- 資料已 restore；`vector` 與 `pg_search` extension 已建立。

實機實測（`chia-paradedb` 容器，2026-08-11）：

| 項目             | 值                                                              |
| ---------------- | --------------------------------------------------------------- |
| extension        | `pg_search 0.25.1`、`vector 0.8.4`（image 另附 postgis 3.6.4 / pg_ivm 1.13 / pg_stat_statements / fuzzystrmatch） |
| schema           | `paradedb`（v1）與 `pdb`（v2），`pg_search` 宣告 `requires = 'vector'` |
| access method    | `bm25`（v1）與 `paradedb`（v2）皆註冊；**v2 的 cast 語法要配 `USING paradedb (...)`** |
| API              | v1（`@@@` + `paradedb.score()` + JSON `text_fields`）與 v2（`pdb.*`）並存 |
| v2 運算子        | `\|\|\|`（OR）、`&&&`（AND）、`###`（phrase）、`===`（exact token）、`@@@`（複雜表達式）、`##` / `##>` |
| v2 函式          | `pdb.score()` / `pdb.snippet()` / `pdb.snippet_positions()` / `pdb.boost()` |
| tokenizer 型別   | `icu`、`jieba`、`lindera`、`chinese_compatible`、`unicode_words`、`simple`、`literal`、`literal_normalized`、`ngram`、`edge_ngram`、`regex_pattern`、`source_code`、`whitespace` |
| token filter     | 確認存在：`lowercase`、`ascii_folding`、`stemmer`、`stopwords_language` |

`lindera` 在這個版本是**參數化的單一型別**（`pdb.lindera(chinese)`），不是 v1 的 `chinese_lindera` 這種獨立名稱 —— 早期版本的 plan 誤記為「不存在」，實際可用。

現有語料規模（同一次實測）：21 feeds / 42 translations / 29 筆有 content / 289 筆 embedding，body 純文字合計約 146 kB。**其中真正的長篇技術文章只有 2 篇（id 78/79），其餘多為測試資料** —— 這對 Phase 3.3 的評測有直接影響，見該節。

待辦（未完成）：

- production（Railway，`infra/railway/`）的 Postgres 尚未換成 ParadeDB image。**在此之前不要把 Phase 4 的 migration 上 production** —— `CREATE EXTENSION pg_search` 會直接失敗。
- 舊 volume `chia-postgres-v2` 仍存在，確認新環境穩定後再清。

### 主要落點

- Token / truncate：`packages/ai/src/embeddings/utils.ts`（`estimateEmbeddingTokens`、`truncateForEmbedding`、`EMBEDDING_INDEX_VERSION`）
- Tokenizer：`packages/ai/src/embeddings/chunking.ts`（`loadTokenizer`、`countEmbeddingTokens`、`splitByHeadings`）
- Embedding 呼叫：`packages/ai/src/embeddings/openai.ts`、`ollama.ts`
- Pipeline：`apps/service/src/steps/feed-embeddings.step.ts` + `apps/service/src/workflows/feed-indexing.workflow.ts`
- Retrieval / 寫入：`packages/db/src/libs/feeds/embedding.ts`（`searchFeeds`、`getRelatedFeeds`、`replaceFeedEmbeddings`）
- Search service：`packages/api/feeds/search.ts`
- Agent 檢索工具：`packages/agent-writing/src/tools/retrieval.tool.ts`
- BM25 / schema：`packages/db/src/schemas/contents.schema.ts` + `@paradedb/drizzle-paradedb`（官方 Drizzle 整合，見 4.3.1）
- 索引同步：`apps/service/src/steps/feed-indexing.step.ts`、`algolia-search.step.ts`、`workflows/feed-indexing.workflow.ts`

---

## 1. 背景與問題

上一輪（`rag-optimization-plan.md`）已完成 structure-aware chunking、chunk 檢索與 feed 聚合。這一輪處理兩個在實際內容上暴露出來的問題。

### 1.1 長文在 index time 直接失敗

```
AI_APICallError: Invalid 'input[0]': maximum input length is 8192 tokens.
```

`input[0]` 是 `feed-indexing.workflow.ts:71` 的 `documentInput`（batch 第一個元素）。它送出前經過 `truncateForEmbedding`，上限 `EMBEDDING_MAX_TOKENS = 7500`，但計數是啟發式的：CJK 算 1 token/字、其餘 0.5（`utils.ts:180`）。

**CJK = 1 這個假設對繁體中文低估。** cl100k_base 對繁中切得比簡中差，常見字 1 token，較冷僻字會 fallback 到 UTF-8 bytes 變成 2–3 tokens。專案 `defaultLocale` 是 `zh-TW`，長中文技術文章估 7500 實際可到 9000+。7500 的 margin 擋不住 1.5–2x 的系統性低估。

### 1.2 document 向量對長文失去代表性

即使 truncate 正確，`buildEmbeddingInput`（`utils.ts:229`）是 title + summary/description + `stripMdx(全文)`，砍到 7500 tokens 等於長文後半段在 document 向量裡不存在。而 document 向量正是 related feeds 的唯一依據（`embedding.ts:369`），也是 chunkless 方向要倚賴的東西。

### 1.3 檢索聚合過於粗糙

`searchFeeds` 取候選後是 per-feed 保留**單一最高分**列（`embedding.ts:345`）。單一 max 很吵：一個用詞剛好相近的段落就能把整篇拉到第一。而且該查詢**沒有 filter `kind`** — document 列與 chunk 列一起參加排序，兩種粒度的分數放在同一個 threshold 下比較。

---

## 2. 本輪目標

1. 讓長文在 index time 不再失敗，且截斷是精確而非估算。
2. 讓 document 向量的長度與品質脫離文章長度。
3. 讓檢索的聚合分數反映「整篇相關」而非「有一句像」。
4. 把 lexical 檢索從 Algolia 搬進 Postgres（ParadeDB BM25），讓 hybrid 不依賴外部索引與 eventual consistency。
5. 讓檢索結果能以**整篇文件**為單位注入 LLM context，並保有可定位的 citation。

## 3. 參考實作：LobeHub

`lobehub/lobehub`（canary，2026-08）的 RAG 是 chunk 檢索 + document 閱讀的混合架構，不是 chunkless。可借鏡的點：

| 機制                                                                            | 位置                                                    | 對應本規劃 |
| ------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------- |
| `groupAndRankFiles`：chunk 命中聚合成檔案層級，分數 = top-3 chunk similarity 平均 | `apps/server/src/services/knowledgeBase/index.ts:47`    | Phase 3    |
| 雙路 `Promise.allSettled`（vector + BM25），不融合、不 rerank，errors 分路回報   | 同檔 `:182`                                             | Phase 3/4  |
| BM25 留在 Postgres：ParadeDB `@@@` + `paradedb.score()`                          | `packages/database/src/repositories/search/index.ts:1034` | Phase 4    |
| `chunks.abstract`：LLM 生成 1–2 句摘要作為嵌入輔助                               | `packages/prompts/src/chains/abstractChunk.ts`          | Phase 1    |
| `trimBatchProbe`：真 tokenizer 邊組邊量，超限先按標點邊界砍，最後才硬截斷        | `packages/utils/src/chunkers/trimBatchProbe/`           | Phase 0    |
| Embedding 分批 + `pMap` 併發 + timeout race + 錯誤寫回 task 狀態                | `apps/server/src/routers/async/file.ts:112`             | Phase 0    |
| Agent 工具 search → 挑選 → `readKnowledge` 讀全文                                | `packages/builtin-tool-knowledge-base/`                 | Phase 5    |

**不採用**：硬寫死 1024 維、`embeddings.chunkId` unique（一個 chunk 只能有一個模型的向量，換模型是破壞性重嵌）、沒有 content hash / index version 的新鮮度機制。這三點本專案現有設計較佳，維持不變。

---

## Phase 0：token 計數與批次正確性

**性質**：bug fix，無 schema 變更，可獨立進。

### 0.1 精確 truncate

`truncateForEmbedding` 改為以 tokenizer 為主、啟發式為 fallback：

```ts
// encode → slice → decode，精確且不需要 margin
const tokens = encoding.encode(text);
if (tokens.length <= maxTokens) return text;
return encoding.decode(tokens.slice(0, maxTokens));
```

- 有 tokenizer 時走精確路徑，`EMBEDDING_MAX_TOKENS` 可從 7500 調回貼近 8192（留小 margin 給 provider 端差異）。
- 沒有 tokenizer 的環境（edge / 無 dynamic import）保留啟發式，但 **CJK 係數從 1 調到 2**，寧可多砍。
- `js-tiktoken` 是 cl100k_base，對 `text-embedding-3-*` 精確；對 Ollama 模型不精確但保守方向正確，可接受。

### 0.2 tokenizer memoize

`loadTokenizer(encoding?)` 目前是 `(encoding ??= await import(...))`，重新賦值參數、沒有真的 cache（`chunking.ts:15`）。`prepareTranslationEmbeddingStep` 每個 translation 呼叫一次，等於每次重建 BPE ranks（~1MB JSON parse）。改成 module-level memo（`let cached: Promise<Tiktoken> | null`），保留現有的 dynamic import 行為（見 commit `6ccab591`）。

### 0.3 送出前 assert

`generateEmbeddings` / `generateEmbedding` / `ollamaEmbedding*` 在呼叫 API 前，對每個 input 做精確 token 檢查；超限就 log 出 translation/model/實際 token 數再截斷。目標是**低估永遠不會變成 provider 400**，且失敗時能直接看到是哪一篇。

### 0.4 batch 分批

`generateEmbeddings` 目前把 document + 全部 chunks 塞成單一 `embedMany` 呼叫。OpenAI 對單一 request 的**總** token 與 array 長度都有上限，長文 chunk 數多時會撞到。加入分批（batch size 由 env 可調，預設 32）與併發控制；沿用 workflow step 的自動 retry，不自建 retry。

### 0.5 驗收

- 拿目前最長的中文文章跑 `feed-indexing` workflow，不再出現 8192 錯誤。
- 單元測試：純中文 / 純英文 / 中英混雜 / 大量 code block 四種輸入，`truncateForEmbedding` 後的實際 cl100k token 數 ≤ 上限。
- 測 fallback 路徑（tokenizer 不可用）同樣不超限。

---

## Phase 1：document 向量改為「文件卡」

**性質**：index-time 表示法變更，需 bump `EMBEDDING_INDEX_VERSION` 全量重嵌，無 schema 變更。

### 1.1 做法

`buildEmbeddingInput` 不再嵌入全文，改為結構化的文件卡：

```
Title: <title>
Summary: <feed_translation.summary ?? description ?? excerpt>
Tags: <tag names>
Outline:
- <H2>
  - <H3>
  ...
```

- `feed_translation.summary` 已存在（`contents.schema.ts:122`），是現成的正解。
- Outline 用既有的 `splitByHeadings`（`chunking.ts:75`）產出 heading 樹，不需要新的 parser。
- 長度由文件結構決定，**永遠碰不到 8192**，跟文章多長無關 — 這是 1.2 節問題的根本解，而非 Phase 0 的止血。

### 1.2 summary 缺失的處理

`summary` 可能為 null。fallback 順序：`summary` → `description` → `excerpt` → `stripMdx(content)` 前 N tokens。若三者都空且文章很長，才觸發 Phase 2 的多向量路徑。

（可選）補一個類似 LobeHub `chainAbstractChunkText` 的 LLM 摘要 step，為缺 summary 的文章生成 1–2 句摘要並寫回 `feed_translation.summary`。這讓文件卡品質不依賴人工填寫，但引入 LLM 成本與非決定性 — **列為 Phase 1 的可選項，預設不做**，先看 fallback 夠不夠。

### 1.3 影響面

- `getRelatedFeeds` 比對的就是 document 向量，主題比對會**變好**（不再被全文稀釋），但相似度分佈會位移 → threshold 要重校（見 Phase 3.3）。
- `stripMdx` 仍保留給 fallback 路徑，不刪。
- `EMBEDDING_INDEX_VERSION` bump 至 `2026-08-10.1`；沿用既有的就地覆寫策略（不做 blue/green，見前一份規劃的實作決策 1）。

---

## Phase 2：長文的多向量 document 表示

**性質**：無 migration。`feed_embedding` 的 unique index 是 `(feed_translation_id, model, kind, chunk_index)`（`contents.schema.ts:179`），本來就允許 `kind="document"` 有多列不同 `chunk_index`。

### 2.1 做法

超過閾值（例如 6000 tokens）的文章，document 層不只一個向量：按 H2 群組切成**粗**段（1500–2000 tokens，不是 chunk 層的 512），每段一個 `kind="document"` 列，`chunk_index` 遞增。

- 檢索時 per-feed 聚合（Phase 3）會把這些列收斂成一個 hit，**對消費端而言檢索單位仍是整篇** — 這是 chunkless 的語意。
- 與 chunk 層的差別是刻意的：chunk 層（512 tokens、含 code、有 `heading_path`）留著做精確定位與 citation；document 層是粗粒度的主題表示。
- `replaceFeedEmbeddings` 目前 document 固定寫 `chunkIndex: 0` 單列（`embedding.ts:155`），需改為接受陣列；orphan 清理邏輯已經按 `chunk_index >= length` 處理 chunk，document 要補上同樣的清理。
- `getFeedEmbeddingMeta` 依賴「document 只有一列」的假設來做 stale 判定（`embedding.ts:212`），要改成取 `chunk_index = 0` 或 `DISTINCT`。**這是 Phase 2 最容易漏的地方。**

### 2.2 為什麼不是直接用 chunk 列

因為兩者的用途不同：chunk 列數量多、粒度細，聚合成 feed 分數時噪音大；document 列數量少（長文也就 3–5 列）、每列都是一個完整主題單元，聚合後的分數更穩。而且 related feeds 只能用 document 列，不能混入 chunk。

---

## Phase 3：檢索聚合與多路容錯

### 3.1 `kind` 參數化

`searchFeeds` 加 `kind?: "document" | "chunk" | "any"`，預設 `"document"`。目前無 filter 導致兩種粒度混在同一個 threshold 下排序（1.3 節）。參數化後可 A/B，不必一次切換。

### 3.2 聚合改為 top-3 平均

取代目前的 per-feed 單一 max（`embedding.ts:345`），照 LobeHub `groupAndRankFiles`：

```
relevanceScore = mean(該 feed 前 3 高的 similarity)
matched        = 保留前 3 列（給 preview / citation）
```

單一 max 是「這篇有一句像」，top-3 平均是「這篇整體相關」。搭配 Phase 2 的多向量 document 特別有效 — 長文若有多個粗段都命中，分數自然更高。

不足 3 列的 feed 用實際列數平均（不補零，否則短文被系統性懲罰）。

### 3.3 threshold 重校

Phase 1/2/3 都會位移相似度分佈，`defaultThreshold: 0.3` 與 `candidateLimit`（`Math.max(limit * 6, 30)`）都必須重校。建立 golden queries 集（這正是前一份規劃 Phase 4 的內容，在此合併執行）：

- 中英文各 15–20 條，涵蓋主題查詢、exact-term 查詢（package 名、CLI、error message）、跨文章查詢。
- 以 vitest script 跑，輸出 recall@5 / MRR，比較 Phase 1 前後與各 threshold。

**語料規模的現實限制（實測）**：目前 42 個 translation 裡真正的長篇技術文章只有 2 篇（id 78/79，且互為中英翻譯），其餘是測試資料。這意味著：

- recall@5 / MRR 在這個語料上**沒有統計意義** —— 只有兩篇候選時，任何檢索策略都會「命中」。
- 因此 threshold 重校**不能只靠 golden queries 的數字**，要靠 4.4 那種「單一查詢的 token 級行為驗證」（明確知道為什麼命中/為什麼落空）加上人工檢查。
- golden queries 仍要建立，但定位是**回歸測試**（改動不要讓已知該中的查詢落空），不是調參依據。等文章數量成長到有意義的規模再拿它調 threshold。
- **exact-term 類是 vector 的已知弱項**，這正是 Phase 4 BM25 要補的；golden queries 要能量出「Phase 4 前後 exact-term recall 的差」，否則無法判斷 Algolia 何時能退場（4.7）。

### 3.4 多路容錯

`searchFeedsService`（`packages/api/feeds/search.ts:118`）目前 vector 與 Algolia 是互斥分支（`model === "algolia"` 走一條、否則走向量），且 Ollama 不可用時整個 throw（`OllamaUnavailableError`）。ParadeDB 進來後路數變三條（vector / BM25 / Algolia 過渡期），互斥分支的結構撐不住，要改：

- `Promise.allSettled` 多路併發，一路失敗其他照回，errors 按路徑分別回報給呼叫端（LobeHub `errors.vector` / `errors.bm25` 的形狀）。
- **BM25 與 vector 在同一個 DB**，所以這兩路可以合成單一 SQL round trip（CTE），只有 Algolia 是真的獨立網路呼叫。先做 allSettled 版本，等 Algolia 退場後再考慮合併成一句 SQL —— 不要一開始就寫成大 CTE，難調難讀。
- 要寫成單一 SQL 時**不用自己推 RRF**：`@paradedb/drizzle-paradedb` 的 [`examples/hybrid-rrf.ts`](https://github.com/paradedb/drizzle-paradedb/blob/main/examples/hybrid-rrf.ts) 就是 drizzle `$with` CTE 版的 RRF（`row_number()` 取 rank → `1.0/(k+rank)` → `unionAll` → `sum` group by），照抄再換掉 table 與欄位即可。同 repo 另有 `examples/rag.ts`、`vector-search.ts`、`faceted-search.ts` 可參考。
- 保留「明確指定 Ollama 卻不可用要 fail loud」的既有語意（那個 throw 是刻意的，見 `embedding.ts:41` 的註解）—— 只有在 hybrid / 自動選路情境下才降級。

---

## Phase 4：in-DB BM25（ParadeDB）

**性質**：實作。ParadeDB 已定案，前置（restore + `vector` / `pg_search`）已完成。這個 phase 不再包含「是否採用」的決策，只剩「索引落在哪、用哪套 API、中文用哪個 tokenizer、Algolia 何時退場」。

### 4.1 動機（維持不變）

lexical 檢索原本在 Algolia：第二套索引、第二套新鮮度問題、外部依賴。BM25 進 Postgres 後可以跟內容寫入在**同一筆 transaction**，這比 Algolia 的 eventual consistency 嚴格更好 —— 不會再有「文章已發布但搜尋還搜不到」的窗口。而且單一 document 向量的召回本來就弱，chunkless 方向一定要 hybrid 撐著。

### 4.2 索引落點：新增 `feed_search_document` 去正規化表

**決策：不直接對 `content.content` / `feed_translation.title` 建兩個 BM25 index，改建一張去正規化的搜尋表。**

理由：

1. `pdb.score()` 是 per-index / per-table 的。要同時對 title 與 body 打分，兩張表兩個 index 就得在應用層自己合分數 —— 那等於自己寫一個爛版本的 field boosting。
2. 過濾條件散在三張表：`published` / `deleted_at` 在 `feed`、`locale` 在 `feed_translation`、tag 名稱要 join 兩層。BM25 查詢混大量 join 會讓 ParadeDB 的 custom scan 難以生效。
3. Phase 1 的「文件卡」文字（title + summary + heading outline + tags）本來就需要一個落地的地方，不然每次查詢都要重算 outline。

schema（`chia_` prefix 由 `pgTable` wrapper 加）：

```
feed_search_document
  feed_translation_id  integer PK  -> feed_translation(id) on delete cascade
  feed_id              integer     -- 聚合與 join 用
  locale               locale
  type                 feed_type
  published            boolean     -- 從 feed 複製，供 BM25 查詢直接過濾
  deleted              boolean     -- 同上（deleted_at IS NOT NULL）
  title                text
  summary              text        -- summary ?? description ?? excerpt
  outline              text        -- heading path 展平，Phase 1 產出
  tags                 text        -- tag 名稱串接
  body                 text        -- cleanMdxKeepStructure(content)
  content_hash         text        -- 與 feed_embedding 同一個 hash，共用 stale 判定
  index_version        text
  updated_at           timestamp
```

- PK 用 `feed_translation_id`（BM25 index 的 `key_field` 需要唯一非空欄位，直接用它，不另開 serial）。
- `published` / `deleted` 複製進來是刻意的去正規化：讓 BM25 查詢不必 join 就能過濾。代價是 feed 的發布狀態改變時要同步這張表 —— 由 Phase 4.5 的同步 step 負責。
- `content_hash` 與 `feed_embedding` 用**同一個** hash，這樣「內容沒變就不用重寫搜尋表」跟 embedding 的 stale 判定是同一套邏輯，不會出現兩套不一致的新鮮度概念。

### 4.3 v1 還是 v2 API

0.25.1 兩套並存。**用 v2**（`pdb.score()`、cast tokenizer、`|||` / `&&&` / `###`）：

- v1 的 JSON `text_fields='{...}'` 設定 blob 已是 legacy（官方文件路徑都移到 `/legacy/` 底下），沿用等於一開始就欠技術債。
- v2 的 cast 語法可以**在寫 migration 前先驗證分詞**，這對中文是決定性的（見 4.4）。
- LobeHub 用的是 v1（`documents.content @@@ query` + `paradedb.score(documents.id)`），抄它的架構但不抄它的 API 版本。

### 4.3.1 用官方套件 `@paradedb/drizzle-paradedb`（已實測）

不需要手寫 migration —— ParadeDB 有官方 Drizzle 整合，且**與本專案版本相容**：

| 需求 | 套件要求 | 專案現況 |
| ---- | -------- | -------- |
| Drizzle | 1.0+ | `1.0.0-rc.4`（`pnpm-workspace.yaml` catalog）✅ |
| Node | ≥ 22.12 | 26.7 ✅ |
| ParadeDB | ≥ 0.25.0 | 0.25.1 ✅ |
| pgvector | 向量搜尋需要 | 0.8.4 ✅ |

**root export 是 namespace，不是扁平的具名匯出**（踩過一次）：

```ts
import { indexing, search, tokenizer } from "@paradedb/drizzle-paradedb";
const { paradedbIndex, paradedbField } = indexing;
const { icu, simple } = tokenizer;
```

schema 寫法（4.4.1 的雙 tokenizer 設定直接可表達）：

```ts
export const feedSearchDocument = pgTable("feed_search_document", { /* ... */ }, (t) => [
  paradedbIndex("feed_search_idx").on(
    t.feedTranslationId,                                  // key_field
    paradedbField(t.title, icu()),
    paradedbField(t.summary, icu()),
    paradedbField(t.body, icu()),
    paradedbField(t.body, simple({ alias: "body_sub" })),
    t.locale, t.published, t.deleted,
  ),
]);
```

`paradedbIndex` 內部就是 drizzle 原生的 `index(name).using("paradedb", ...).with({ key_field })`，所以 **drizzle-kit 完全認得這個 index**。實測結果：

1. `drizzle-kit generate` 產出正確 SQL：

   ```sql
   CREATE INDEX "feed_search_idx" ON "chia_feed_search_document" USING paradedb (
     "feed_translation_id",(("title")::pdb.icu),(("summary")::pdb.icu),
     (("body")::pdb.icu),(("body")::pdb.simple('alias=body_sub')),
     "locale","published","deleted") WITH (key_field=feed_translation_id);
   ```

2. **第二次 `generate` 回報 `No schema changes, nothing to migrate`** —— 沒有 `DROP INDEX` churn。原本列為「Phase 4 最容易在幾週後咬人」的風險**解除**。
3. 產出的 SQL 在實機執行成功，`pg_indexes.indexdef` 讀回一致；`key_field=feed_translation_id` 不加引號是合法的。
4. runtime 實測 `search.phrase()` / `search.score()` / `search.alias()` / `search.snippet()` 全部可用，中文 phrase 與 `body_sub` 子識別字查詢結果都正確。

**唯一的注意事項：`drizzle-orm` 在該套件裡是 `dependencies` 而不是 `peerDependencies`，且 pin 在 `1.0.0-rc.2`。** 實測 pnpm 會裝**兩份** drizzle-orm（rc.2 + rc.4）。目前功能正常（`sql` 物件是 duck-typed，跨版本可互通），但這是典型的 duplicate-instance 風險，之後某個版本可能因 `instanceof` 檢查而爆。建議在 `pnpm-workspace.yaml` 加 `overrides` 鎖成單一版本 —— 注意 pnpm 10+ 已把 overrides 移到 `pnpm-workspace.yaml`，寫在 `package.json` 的 `pnpm.overrides` 會被忽略（實測會噴 WARN）。

若不想引入這個依賴，`paradedbIndex` + `paradedbField` + tokenizer render 合計約 80 行、`search.*` 約 370 行，抄一份也不難。但既有官方套件且版本相容，直接用。

### 4.4 中文 tokenizer：已實測定案

測試句：`這篇文章講的是 pgvector 的 HNSW 調校與 ef_search 參數設定`

| tokenizer            | 輸出                                                              | 判定 |
| -------------------- | ----------------------------------------------------------------- | ---- |
| **`icu`**            | `{這篇文章,講,的是,pgvector,的,hnsw,調校,與,ef_search,參數,設定}` | ✅ 繁中詞彙正確 + **識別字保持完整** |
| `lindera(chinese)`   | `{這,篇,文章,講,的,是,pgvector,的,hnsw,調,校,與,ef,_,search,參數,設定}` | ❌ 「調校」被切開；`ef_search` 拆成 `ef`/`_`/`search`；標點進索引 |
| `jieba`              | `{這,文章,篇文章,講的,是," ",pgvector," ",的,...,ef,_,search," ",參數,設定}` | ❌ token 重疊、空白與標點成為 token、識別字被拆 |
| `chinese_compatible` | `{這,篇,文,章,講,的,是,pgvector,的,hnsw,調,校,與,ef,search,參,數,設,定}` | ❌ CJK 逐字；識別字被拆 |
| `unicode_words`（預設） | 同 `chinese_compatible`（CJK 逐字）                            | ❌ |

繁中純句 `繁體中文的斷詞與檢索：向量搜尋、關鍵字搜尋與混合檢索`：

- `icu` → `{繁體,中文,的,斷詞,與,檢索,向量,搜尋,關鍵字,搜尋,與,混合,檢索}` —— 分詞正確、標點自動剔除
- `lindera(chinese)` → 把「斷詞」切成 `斷`/`詞`，且 `：`、`、` 進索引
- `chinese_compatible` / `unicode_words` → 全部逐字

**決策：`icu` 作為所有文字欄位的主 tokenizer。** 它同時解掉繁中分詞與識別字完整性兩件事，`jieba` / `lindera` / `chinese_compatible` 沒有一個在這兩項上贏它。上一版擔心的「繁中分詞不如 Algolia」在 `icu` 上不成立。

### 4.4.1 `icu` 的一個陷阱與解法（實測發現）

`icu` **不會在英數之間的 `.` 上斷詞**：

```sql
SELECT 'SET hnsw.ef_search = 100;'::pdb.icu::text[];
-- {set,hnsw.ef_search,100}
```

所以原文寫成 `SET hnsw.ef_search = 100;`（實際語料就是這樣寫）時，索引裡的 token 是 `hnsw.ef_search`，而使用者搜 `ef_search` **會 0 筆命中**。實測確認過這個 false negative。

解法是同欄位掛第二個 tokenizer（`simple`，在任何非英數字元上斷詞）：

```sql
CREATE INDEX feed_search_idx ON chia_feed_search_document
USING paradedb (
  feed_translation_id,
  (title::pdb.icu),
  (summary::pdb.icu),
  (outline::pdb.icu),
  (body::pdb.icu),                          -- 不加 alias：中文與完整識別字
  (body::pdb.simple('alias=body_sub')),     -- 子識別字（phrase 查詢用）
  locale, published, deleted
) WITH (key_field='feed_translation_id');
```

查詢端：

```sql
-- 中文（走未 alias 的 icu，用 phrase 提高精度）
WHERE body ### '向量搜尋'
-- 識別字（兩路 OR：完整 token 或子 token 相鄰）
WHERE body ||| 'ef_search' OR body::pdb.alias('body_sub') ### 'ef_search'
```

實測結果：`body_sub` 的 phrase 查詢正確命中兩篇（`ef_search` → `ef`,`search` 相鄰），且中文查詢不受影響。**代價只有 3016 kB → 3088 kB**（+72 kB；這個語料下 3 MB 幾乎全是 segment 固定開銷）。

注意 `simple` 對純中文只會吐出**整串一個 token**（`繁體中文的斷詞與檢索` → 單一 token），所以**中文查詢絕對不要打 `body_sub`**，那條路只服務識別字。

### 4.4.2 查詢寫法的兩個硬性要求（實測發現）

**一、`ORDER BY` 必須直接寫 `pdb.score(key_field)`，不能用 SELECT 別名。**

```sql
-- ✅ TopKScanExecState，Top-K 下推到索引
ORDER BY pdb.score(feed_translation_id) DESC LIMIT 5
-- ❌ 退化成 Normal scan，ParadeDB 會 WARNING
SELECT ..., pdb.score(feed_translation_id) AS score ... ORDER BY score DESC LIMIT 5
```

第二種寫法會噴 `Query has LIMIT 5 but is not using Top K scan (using Normal instead)`。語料小時看不出差別，但這是會在資料長大後才發現的效能陷阱，一開始就要寫對。

**二、過濾欄位放進索引就會下推。** `locale === 'zh-TW' AND published = true` 實測會被編進 Tantivy query 的 `boolean.must`：

```json
{"boolean":{"must":[
  {"with_index":{"query":{"tokenized_phrase":{"field":"body","phrase":"向量搜尋"}}}},
  {"with_index":{"query":{"term":{"field":"locale","value":"zh-TW"}}}},
  {"term":{"field":"published","value":true}}]}}
```

這驗證了 4.2 去正規化的設計 —— `published` / `deleted` / `locale` 複製進搜尋表後，過濾完全在索引內完成，不需要 join。

`pdb.snippet(body)` 也實測可用，回傳 `<b>` 標記的片段，可以直接餵給 Phase 5 的 citation preview。

### 4.5 索引同步

現有 `feed-indexing.workflow.ts` 已經是「一個 snapshot 分岔成 embeddings / reading time / Algolia 三路」的結構，BM25 就是第四路：

- 新增 `feed-search-document.step.ts`，從既有的 `FeedIndexingSnapshot` upsert `feed_search_document`。
- 用 `content_hash` 跳過未變更內容，與 embeddings 共用 Phase 1 產出的 `documentInput` / outline，不重複計算。
- 這一路**不需要外部 API**，所以它是所有分支中最不可能失敗的一路；`published` 狀態變更（不改內容）也要能觸發它，否則會出現「已下架但仍可被搜到」。這一點跟 Algolia 現有行為要對齊檢查。

### 4.6 融合策略

先照 LobeHub 的做法分兩種情境：

- **Agent 檢索**：不融合、不 rerank。vector 與 BM25 兩組結果並列回給 model，並在 tool description 說明兩者差異（「前者比意義、後者比字面」），由 model 判斷。省掉一個 reranker 服務。
- **公開站搜尋**：需要單一排序列表，用 RRF 融合（約 50 行）。

### 4.7 Algolia 退場條件

不在 Phase 4 直接拔掉。等 Phase 3.3 的 golden queries 在 BM25 上跑出結果，與 Algolia 現況做同集合對比：

- BM25 的 exact-term recall ≥ Algolia → 開始收斂，Algolia 降為 fallback，觀察一個週期後移除。
- 明顯較差（大概率是 4.4 的 tokenizer 選擇問題）→ 先調 tokenizer / 欄位切分，不要急著回頭。

留意 Algolia 的 `AlgoliaFeedHit.version: "2026.07.13"` 與 `ALGOLIA_FEEDS_INDEX_NAME` env；移除時 dash 端的 keyword 模式（`mode: "algolia"`）與 `searchPostsTool` 的 `mode` 參數語意都要一起改，不能只刪 service。

---

## Phase 5：Chunkless context 注入

**性質**：真正把「檢索到的是文件、餵給 LLM 的是全文」串起來。前一份規劃的 Phase 5（完整 RAG）在此具體化。

### 5.1 現況

Agent 那條路徑已經接近 chunkless：`searchPosts` → `getPost` 回整篇 MDX（`retrieval.tool.ts:120`）。但守門只有字元截斷 `MAX_POST_BODY_CHARS = 24_000`，中文下約 8–12k tokens，而且是 per-post 而非 per-request。

### 5.2 要補的

1. **Token budget 而非字元數**：用 Phase 0 的精確 tokenizer 計算，預算是 per-request 的（多篇文章共享），不是 per-post。超預算時的降級順序：全文 → 命中的 H2 章節全文 + 其餘 outline → 只給 outline + summary。
2. **章節定位回填 citation**：chunkless 的代價是失去 chunk 列帶的 `heading_path`。在 read time 用 `splitByHeadings` + `github-slugger`（repo 已有依賴，`services/feeds/index.ts` 在用）重算 heading anchor，讓引用可以連到 `#heading`。
3. **取對欄位**：`content.content` / `content.source`，**不是** `unstable_serialized_source`。
4. **Prompt caching**：全文注入的成本主要在 input token，靠 caching 攤平。這是 chunkless 成本模型能成立的前提。

### 5.3 成本認知

Chunkless 是把 index-time 的複雜度換成 **per-query 的 token 帳單**。以本專案規模（個人部落格、文章數量有限、已有 document 向量與全文表）這筆換得過，但要在 Phase 5 明確量出「每次檢索平均注入多少 token」，否則成本會無聲增長。

---

## 6. 執行順序與依賴

```
Phase 0 ──┬─> Phase 1 ──> Phase 2 ──> Phase 3 ──> Phase 5
          │                  │            ↑
          │                  └─> Phase 4 ─┘
          └─> Phase 5.1 (token budget 共用 Phase 0 的 tokenizer)
```

- **Phase 0 可以馬上進**，獨立、是 bug fix、不需要重嵌。
- Phase 1 + 2 + 3 + 4 應該**一起上線**：四者都影響檢索結果與相似度/分數分佈，分開上線等於要重校四次。
- **Phase 4 現在依賴 Phase 1**（`feed_search_document.outline` / `summary` 是 Phase 1 的產出），不再是可完全平行的獨立評估。但 4.4 的 tokenizer 量測**可以立刻做**，不需要等任何 phase —— 只要一個 psql session，而且它的結論會影響 4.2 的欄位切分，越早越好。
- Phase 5 依賴 Phase 3 的檢索結果形狀（top-3 matched 列）。

### 建議的第一批動作

1. ~~tokenizer 實測~~ ✅ **已完成（2026-08-11）**，結論見 4.4：`icu` 主 tokenizer + `body_sub`（`simple`）第二 alias。
2. ~~確認 `drizzle-kit generate` 對 `USING paradedb` index 的行為~~ ✅ **已完成（2026-08-11）**，見 4.3.1：改用官方套件 `@paradedb/drizzle-paradedb`，generate 行為正確、無 churn。
3. 進 Phase 0（純 bug fix，與其他 phase 不互相干擾）。
4. 裝 `@paradedb/drizzle-paradedb` 並在 `pnpm-workspace.yaml` 補 `drizzle-orm` override。
5. 之後才是 Phase 1 → 2 → 4 → 3 的實作與一次性重嵌。

到此 Phase 4 的技術未知項**全部清空**：tokenizer 已定案（4.4）、查詢寫法已驗證（4.4.2）、schema/migration 工具鏈已驗證（4.3.1）。剩下的只有實作與 production image 的抽換。

## 7. 風險

| 風險                                                          | 緩解                                                                        |
| ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 文件卡讓 document 向量失去細節，related feeds 變差            | Phase 3.3 golden queries 必須在 Phase 1 前後各跑一次做對照，不可只看體感    |
| `getFeedEmbeddingMeta` 的「document 單列」假設在 Phase 2 破掉 | 明列為 Phase 2 的 checklist 項；stale 判定寫測試覆蓋多列 document           |
| threshold 重校不足導致召回下降                                | 保留 `kind` 參數與 `comparison` 可覆寫，出問題可即時調回而不需重嵌          |
| Chunkless 的 per-query token 成本無聲增長                     | Phase 5.3 要求量測並記錄平均注入 token；設上限而非只設截斷                  |
| ~~繁中 tokenizer 選擇失誤~~                                    | **已解除**：4.4 實測 `icu` 同時滿足繁中分詞與識別字完整性 |
| `icu` 不在英數間的 `.` 斷詞，`hnsw.ef_search` 這類寫法會讓子識別字查不到 | 4.4.1 的 `body_sub`（`simple`）第二 alias + phrase 查詢；查詢端兩路 OR。**這是 false negative，不會有錯誤訊息**，要寫進回歸測試 |
| `ORDER BY` 用 SELECT 別名導致 Top-K 不下推                     | 4.4.2：一律直接寫 `ORDER BY pdb.score(key_field) DESC`；小語料看不出來，資料長大才會痛 |
| 語料太小，golden queries 數字無意義                            | Phase 3.3：golden queries 定位為回歸測試而非調參依據；threshold 靠 token 級行為驗證 |
| **production（Railway）仍是非 ParadeDB image**                | Phase 4 migration 上 production 前必須先換 image；否則 `CREATE EXTENSION pg_search` 直接失敗。列為 Phase 4 的 blocking 前置 |
| ~~`drizzle-kit generate` 不認識 bm25 index~~                   | **已解除**：4.3.1 實測官方套件產出的 index drizzle-kit 完全認得，第二次 generate 無變更 |
| `@paradedb/drizzle-paradedb` 把 `drizzle-orm` 當 dependency 並 pin rc.2，會裝兩份 | 4.3.1：`pnpm-workspace.yaml` 加 `overrides` 鎖單一版本（**不是** `package.json` 的 `pnpm.overrides`，pnpm 10+ 會忽略） |
| `feed_search_document` 的去正規化欄位（`published`/`deleted`）與來源不同步 | 同步 step 要能被「只改發布狀態」觸發（4.5）；與 Algolia 現有觸發條件對齊檢查，避免已下架仍可搜到 |
| BM25 index 的寫入放大與體積                                   | 部落格規模下可忽略，但 migration 後記錄一次 index 體積作為基線                |
| 全量重嵌成本                                                  | 沿用既有判斷：部落格規模下 reindex 是分鐘級、美分級；就地覆寫，rollback = 調回版本號重跑 |
