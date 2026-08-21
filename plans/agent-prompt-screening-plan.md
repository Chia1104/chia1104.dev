# Agent Prompt Screening 計劃

> 狀態：提案，尚未實作
> 建立日期：2026-08-20
> 最後更新：2026-08-20
> 範圍：`packages/api` 的 agent contract 與 `AgentKindService`、`apps/service` 的 host port 與 env、`packages/db` 新表、public kind 的 enqueue 路徑
> 前置：`docs/agent-architecture.md` §2（kind / tier）、§4（enqueue）；issue #3001（per-turn budget，與本計畫互補）

## 0. 目的與非目標

在 public kind 上線前，於**訊息進入 workflow 之前**做兩件事：

1. **預防**：攔下 prompt injection / jailbreak 句型與有害內容，不啟動 turn、不扣配額。
2. **偵測**：每次判定都留紀錄，讓 operator 能回頭看誰被擋、擋得對不對、誰在反覆試探。

前提要講清楚：public kind 的 `service` 權限邊界已由 port 守住（read-only、published-only、無 `WebPort`），screening **不是**安全邊界，它省的是 provider 成本與避免生成不當內容。所以這層要輕、要可換、誤判要可見。

**非目標**

- 不對 assistant 輸出做 moderation。read-only agent 的輸出來源是作者自己的文章，風險不值一次額外 call。
- 不在 system prompt 裡加自我防衛指令。會被 inject 的模型正好不會理它。
- 不做 per-user 封鎖的自動化策略（例如「連續三次 block 就停權」）。先有紀錄，看過真實分佈再決定。
- writing kind 不掛 screening。只有你自己在用。

## 1. 分類器選型

使用者指定的方向是「Prompt Guard 2 抓 injection + OpenAI Moderation 抓有害內容」。查證後的實際狀況：

| 分類器 | 抓什麼 | 可用途徑 | 查證結果 |
| --- | --- | --- | --- |
| **Llama Prompt Guard 2 (86M)** | injection / jailbreak 句型；二元 `benign` / `malicious`；多語（含中文）；輸入 512 tokens | **Hugging Face Inference**（`hf-inference` provider 對 `meta-llama/Llama-Prompt-Guard-2-86M` 狀態 live；模型 gated，需在 HF 接受 Llama 授權並用 token 呼叫） | **Cloudflare Workers AI 沒有這個模型**——目錄裡只有 `@cf/meta/llama-guard-3-8b`。原本「走 Workers AI」的前提不成立。 |
| **OpenAI Moderation** (`omni-moderation-latest`) | 仇恨、騷擾、性、暴力、自傷、非法等 13 類；回 `flagged` + 每類 score；多語 | `POST /v1/moderations`，免費 | `apps/service/src/env.ts` 已有 `OPENAI_API_KEY`（optional）。 |

**決定**：Prompt Guard 2 走 HF Inference，OpenAI Moderation 走官方 API。兩個都是 HTTP call、無 SDK 依賴、都在 port 後面，任一個要換都只動 host 檔案。

**替代方案（記錄，不做）**

- **Prompt Guard 2 in-process**：社群有 ONNX 轉換（`sinatras/Llama-Prompt-Guard-2-86M-ONNX`，transformers.js 可載），86M DeBERTa 在 CPU 上是毫秒級，不需外部供應商。代價是 `onnxruntime-node` 原生二進位進 Nitro build 與 Railway image、模型檔要 bake 進 image，而且轉換檔不是 Meta 官方發佈。等 HF Inference 的延遲或可用性真的成為問題再換——port 不變。
- **Workers AI `llama-guard-3-8b`**：8B 生成式模型，輸出 `safe` / `unsafe` + 類別，慢且不專攻 injection。若想全部留在 Cloudflare 可以取代 OpenAI Moderation 的位置，但不能取代 Prompt Guard。

## 2. 架構

### 2.1 放在哪一層

```text
oRPC chat route
  └─ agentSessionGuard            tier / ownership（不變）
      └─ AgentKindService.prompt  ← 這裡：screen() 之後才 enqueue
            ├─ screen(text)  →  allow → 既有流程（resume hook 或 start workflow）
            │                →  block → 寫紀錄、throw PROMPT_REJECTED，不建 run、不扣配額
            └─ ...
```

放在 `prompt()` 而不是 oRPC middleware，因為 screening 是 **kind 的屬性**（與 `minTier` 同一層概念）：writing kind 不建 port，public kind 建。route 共用、行為由 kind 決定，沿用 §2 的設計。

只 screen `action.type === "prompt"` 的 `text`。`approve` 的 `comment` 是 operator 寫給模型的話，不是 prompt；public kind 沒有需要 approval 的工具，根本不會有 approve。

### 2.2 PromptScreenPort

```ts
// packages/api/orpc/services/prompt-screen.ts（port 型別，與 AgentKindService 同層）
export type PromptScreenVerdict =
  | { verdict: "allow"; signals: PromptScreenSignal[] }
  | { verdict: "block"; reason: PromptScreenReason; signals: PromptScreenSignal[] };

export type PromptScreenReason = "injection" | "harmful";

export interface PromptScreenSignal {
  source: "prompt-guard" | "openai-moderation";
  /** 分類器自己的標籤：`malicious`、`harassment/threatening`… */
  label: string;
  score: number;
  /** 單一 source 失敗時仍回 allow，但留下訊號 */
  error?: string;
}

export interface PromptScreenPort {
  screen(input: { text: string }, signal: AbortSignal): Promise<PromptScreenVerdict>;
}
```

host 實作 `apps/service/src/services/prompt-screen.port.ts`：

- 兩個分類器**並行**呼叫（`Promise.allSettled`），各自 5 秒 timeout。
- Prompt Guard：`malicious` score ≥ `0.8` → `block("injection")`。輸入超過 512 tokens 時切 chunk（按段落），任一 chunk 超標即 block——injection 常藏在長文末尾。
- Moderation：`flagged === true` → `block("harmful")`；不另設門檻，用 OpenAI 自己校準過的。
- **fail-open**：任一 source 失敗回 `allow` 並在 `signals` 帶 `error`。理由：public agent 是 read-only，誤放的代價是幾千 token；誤擋所有人（供應商當機）的代價是功能整個死。但兩個都失敗時要 Sentry 告警。
- 門檻與 timeout 是 port 常數，不是 env。

### 2.3 紀錄：`agent_prompt_screen`

這張表是「偵測」功能的本體，分類器只是訊號來源。

```text
agent_prompt_screen
  id            uuid pk
  user_id       text  fk user.id
  session_id    text  fk agent_session.id
  kind          text
  verdict       enum  allow | block
  reason        enum  injection | harmful | null
  signals       jsonb PromptScreenSignal[]
  text_hash     text  sha256；不存原文
  text_length   int
  created_at    timestamptz
  index (user_id, created_at), index (verdict, created_at)
```

- `allow` 也寫。沒有 allow 的基線就看不出 block 率，也看不出分類器對正常使用者的 false positive。
- **不存原文**。存 hash 足夠比對重送與同文多人試探；原文留在 `agent_session_entry`（allow 的話）或根本不留（block 的話）。這是資料最小化，也避免這張表變成有害內容的倉庫。
- 寫入與 `block` 的 throw 在同一個 try：紀錄失敗不能讓 block 變 allow，反過來也一樣——紀錄失敗就讓 request 以 500 結束。

### 2.4 Contract 與 client

- `chatAgentContract.errors` 新增 `PROMPT_REJECTED: { data: z.object({ reason: z.enum(["injection", "harmful"]) }) }`。一個 reason 給 client 選文案用，不回 score、不回 signals——回得越多，試探者學得越快。
- `text: z.string().min(1)` 補上 `.max(4000)`。這是最便宜的一層；writing kind 也適用。
- `@chia/agent-elements` 的 composer 收到 `PROMPT_REJECTED` 時保留輸入、顯示一句不帶指責的提示。不清空 session、不顯示任何 store 變化——因為什麼都沒發生。

### 2.5 偵測的消費端

第一版只要 `dash` 有一頁能看：按 `verdict` / `reason` 篩、按 user 聚合最近 24h 的 block 次數、點開看 `signals`。oRPC 加一個 `agent.screen.list`（`minTier: Root`）。自動封鎖等有資料再說（§0 非目標）。

### 2.6 Env

`apps/service/src/env.ts`：

- `HF_TOKEN: z.string().min(1)` — 新增；用 fine-grained token，只給 inference 權限。
- `OPENAI_API_KEY` — 從 `optional()` 改為 public kind 啟用時必填。用 `.superRefine` 綁在 kind 啟用旗標上比讓整個 service 在沒 key 時拒啟動合理；或直接改 required，看 `service` 其他地方怎麼用它。

`.env.example`、`turbo.json` `globalPassThroughEnv`、Railway 變數同步。

## 3. 與其他防線的關係

| 防線 | 擋什麼 | 在哪 |
| --- | --- | --- |
| `text.max(4000)` | 超長 prompt | contract |
| **本計畫 screening** | injection 句型、有害內容 | `prompt()` enqueue 前 |
| per-user 配額（待開 issue） | 長期濫用、成本 | `prompt()` enqueue 前，screening 之後 |
| #3001 per-turn budget | 單輪失控 loop | Pi `tool_call` hook |
| port visibility / no WebPort | 越權、exfiltration | host 建 port 時 |

順序上 screening 在配額之前：被擋的 prompt 不該吃掉使用者的額度。

## 4. 測試

- `prompt-screen.port`：mock 兩個 HTTP endpoint；驗證門檻、chunking、並行、單一失敗 fail-open 並帶 `error` signal、雙失敗告警、timeout。
- `AgentKindService.prompt`（public kind）：`block` 時不呼叫 workflow start / hook resume、寫了一筆紀錄、throw `PROMPT_REJECTED`；`allow` 時紀錄一筆且流程不變。
- writing kind：確認沒有 screening 參與（port 為 `undefined` 的路徑）。
- 一組固定的 fixture prompts（中英各幾則 benign / injection / harmful）跑在 port 測試裡，用錄下的分類器回應——不打真 API。

## 5. Phases

| Phase | 內容 | 可獨立交付 |
| --- | --- | --- |
| Phase 1：contract 與 schema | `text.max`、`PROMPT_REJECTED`、`agent_prompt_screen` 表與 migration、`PromptScreenPort` 型別 | 是（無行為改變） |
| Phase 2：host port | `prompt-screen.port.ts`、env、測試 | 是 |
| Phase 3：接進 public kind | `prompt()` 的 screen → record → enqueue；client 錯誤處理 | 與 public kind 本體一起 |
| Phase 4：偵測頁 | `agent.screen.list` + dash 列表 | 是 |

Phase 1–2 可以在 public kind 存在之前先合併；Phase 3 是 public kind PR 的一部分。

## 6. 會動到的檔案

```text
新增
  packages/api/orpc/services/prompt-screen.ts
  apps/service/src/services/prompt-screen.port.ts
  apps/service/__tests__/prompt-screen.port.test.ts
  packages/db/src/schemas/agent.schema.ts                 agent_prompt_screen
  packages/db/src/repos/agent-screen.ts
  packages/api/orpc/contracts/agent-screen.contract.ts    list（Root）
  apps/dash/src/components/agent/screen-log.tsx

修改
  packages/api/orpc/contracts/agent.contract.ts           text.max、PROMPT_REJECTED
  packages/api/orpc/services/agent.service.ts             AgentKindService 可選的 screen port
  apps/service/src/services/agent.service.ts              public kind 的 prompt() 流程
  apps/service/src/env.ts, .env.example, turbo.json       HF_TOKEN、OPENAI_API_KEY
  packages/agent-elements/src/composer.tsx                PROMPT_REJECTED 文案
  docs/agent-architecture.md                              §2 kind 屬性加 screening、§4 enqueue 流程
```

## 7. 待確認

1. **fail-open**（§2.2）——接受「分類器掛掉時放行」，還是寧可 fail-closed 讓 public agent 暫停？
2. **Prompt Guard 門檻 0.8**——Meta 建議值附近；上線後用 `agent_prompt_screen` 的分佈調，這裡只要同意起點。
3. **HF Inference 作為 injection 分類器的供應商**——多一個 HF token 在 Railway 上。若不想多供應商，替代是 in-process ONNX（§1）。
4. `OPENAI_API_KEY` 改 required 會不會影響 `service` 現在的其他路徑（要看 `packages/ai` 怎麼讀它）。
