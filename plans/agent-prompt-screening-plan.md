# Agent Prompt Screening 計劃

> 狀態：提案，尚未實作
> 建立日期：2026-08-20
> 最後更新：2026-08-24（對齊 `AgentKindDefinition` registry、`agent` Postgres schema、泛型 kind service）
> 範圍：`apps/service/src/agents/kind.ts` 的 definition 與 `agents/service.ts` 的 `prompt()`、`packages/api` 的 contract 與 port 型別、`packages/db` 的 `agent.prompt_screen` 表、host port 與 env
> 前置：`docs/agent-architecture.md` §2（kind definition / tier）、§4「Enqueue and durable driver」與「Turn budget」

## 0. 目的與非目標

在 public kind 上線前，於**訊息進入 workflow 之前**做兩件事：

1. **預防**：攔下 prompt injection / jailbreak 句型與有害內容，不啟動 turn、不扣配額。
2. **偵測**：每次判定都留紀錄，讓 operator 能回頭看誰被擋、擋得對不對、誰在反覆試探。

前提要講清楚：public kind 的 `service` 權限邊界已由 port 守住（read-only、published-only、無 `WebPort`），單輪失控由 turn budget 守住（§4「Turn budget」）。screening **不是**安全邊界，它省的是 provider 成本與避免生成不當內容。所以這層要輕、要可換、誤判要可見。

**非目標**

- 不對 assistant 輸出做 moderation。read-only agent 的輸出來源是作者自己的文章，風險不值一次額外 call。
- 不在 system prompt 裡加自我防衛指令。會被 inject 的模型正好不會理它。
- 不做 per-user 封鎖的自動化策略（例如「連續三次 block 就停權」）。先有紀錄，看過真實分佈再決定。
- writing kind 不掛 screening。只有你自己在用。

## 1. 分類器選型

使用者指定的方向是「Prompt Guard 2 抓 injection + OpenAI Moderation 抓有害內容」。查證後的實際狀況：

| 分類器                                           | 抓什麼                                                                                   | 可用途徑                                                                                                                                                     | 查證結果                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **Llama Prompt Guard 2 (86M)**                   | injection / jailbreak 句型；二元 `benign` / `malicious`；多語（含中文）；輸入 512 tokens | **Hugging Face Inference**（`hf-inference` provider 對 `meta-llama/Llama-Prompt-Guard-2-86M` 狀態 live；模型 gated，需在 HF 接受 Llama 授權並用 token 呼叫） | **Cloudflare Workers AI 沒有這個模型**——目錄裡只有 `@cf/meta/llama-guard-3-8b`。 |
| **OpenAI Moderation** (`omni-moderation-latest`) | 仇恨、騷擾、性、暴力、自傷、非法等 13 類；回 `flagged` + 每類 score；多語                | `POST /v1/moderations`，免費                                                                                                                                 | `apps/service/src/env.ts` 已有 `OPENAI_API_KEY`（optional）。                    |

**決定**：Prompt Guard 2 走 HF Inference，OpenAI Moderation 走官方 API。兩個都是 HTTP call、無 SDK 依賴、都在 port 後面，任一個要換都只動 host 檔案。

**替代方案（記錄，不做）**

- **Prompt Guard 2 in-process**：社群有 ONNX 轉換（`sinatras/Llama-Prompt-Guard-2-86M-ONNX`，transformers.js 可載），86M DeBERTa 在 CPU 上是毫秒級，不需外部供應商。代價是 `onnxruntime-node` 原生二進位進 Nitro build 與 Railway image、模型檔要 bake 進 image，而且轉換檔不是 Meta 官方發佈。等 HF Inference 的延遲或可用性真的成為問題再換——port 不變。
- **Workers AI `llama-guard-3-8b`**：8B 生成式模型，輸出 `safe` / `unsafe` + 類別，慢且不專攻 injection。若想全部留在 Cloudflare 可以取代 OpenAI Moderation 的位置，但不能取代 Prompt Guard。

## 2. 架構

### 2.1 放在哪一層：kind definition 的一個成員

現在的 kind 是 `apps/service/src/agents/<kind>.ts` 的 `AgentKindDefinition`，由 `AGENT_KINDS`（`agents/registry.ts`）註冊；service 是泛型的 `createAgentKindService(definition)`，「只提供該 kind 不一樣的部分」是 definition 的設計原則。screening 正是這種東西——與 `minTier` 同層的 kind 屬性——所以它是 definition 的一個**可選成員**，由泛型 `prompt()` 呼叫：

```ts
// apps/service/src/agents/kind.ts
export interface AgentKindDefinition<TState> {
  // ...
  /**
   * Screens operator text before it is enqueued. Absent on kinds whose only operator is the
   * author; a public kind supplies one. `prompt()` refuses the message when it returns `block`
   * and records every verdict either way.
   */
  readonly screen?: PromptScreenPort;
}
```

writing kind 不設定；public kind 在自己的 definition 檔案裡建 port。沒有 registry 旗標、沒有 middleware——泛型 service 讀 `definition.screen`，有就用。

```text
oRPC chat route
  └─ agentSessionGuard                tier / ownership（不變）
      └─ createAgentKindService.prompt()
            ├─ loadOwnedSession、/end sentinel、undecided approvals   ← 既有、便宜、先做
            ├─ definition.screen?.screen({ text })                     ← 這裡：一個 HTTP round-trip
            │     ├─ allow → recordPromptScreen(allow) → 既有流程（resume hook 或 start workflow）
            │     └─ block → recordPromptScreen(block) → throw PromptRejectedError，不建 run、不扣配額
            └─ ...
```

順序刻意放在既有的本地檢查之後：sentinel 與 outstanding-approval 的拒絕不花錢，不該為它們先打一次分類器。

**什麼要 screen**：`prompt()` 的 `input.text`，不論有沒有 `template`。slash command（`action.type === "command"`）也走 `prompt()`，其 `text` 是使用者打的參數，一樣是使用者輸入。`approve` 走 `approve()`，不經過這裡；public kind 沒有需要 approval 的工具，根本不會有。

### 2.2 PromptScreenPort

port 型別放 `packages/api/orpc/services/prompt-screen.ts`，與 `AgentKindService` 同層——route 與 service 都要認得 `PromptRejectedError`，而 `packages/api` 是兩者唯一的共同依賴。

```ts
export type PromptScreenReason = "injection" | "harmful";

export interface PromptScreenSignal {
  source: "prompt-guard" | "openai-moderation";
  /** 分類器自己的標籤：`malicious`、`harassment/threatening`… */
  label: string;
  score: number;
  /** 單一 source 失敗時仍回 allow，但留下訊號 */
  error?: string;
}

export type PromptScreenVerdict =
  | { verdict: "allow"; signals: PromptScreenSignal[] }
  | {
      verdict: "block";
      reason: PromptScreenReason;
      signals: PromptScreenSignal[];
    };

export interface PromptScreenPort {
  screen(
    input: { text: string },
    signal: AbortSignal
  ): Promise<PromptScreenVerdict>;
}

/** Thrown by `prompt()`; the route maps it onto the contract's `PROMPT_REJECTED`. */
export class PromptRejectedError extends Error {
  constructor(readonly reason: PromptScreenReason) {
    super(`Prompt rejected: ${reason}`);
  }
}
```

host 實作 `apps/service/src/services/prompt-screen.port.ts`（與 `agent-web.port.ts`、`content-read.port.ts` 並列）：

- 兩個分類器**並行**呼叫（`Promise.allSettled`），各自 5 秒 timeout。
- Prompt Guard：`malicious` score ≥ `0.8` → `block("injection")`。輸入超過 512 tokens 時按段落切 chunk，任一 chunk 超標即 block——injection 常藏在長文末尾。
- Moderation：`flagged === true` → `block("harmful")`；不另設門檻，用 OpenAI 自己校準過的。
- **fail-open**：任一 source 失敗回 `allow` 並在 `signals` 帶 `error`。理由：public agent 是 read-only，誤放的代價是幾千 token（且有 turn budget 兜底）；誤擋所有人（供應商當機）的代價是功能整個死。兩個都失敗時 Sentry 告警。
- 門檻與 timeout 是 port 常數，不是 env。
- 與 Firecrawl 一樣，client 在 module scope 建構，所以 public kind 的 definition 用 dynamic import 載入 port——registry 的 `load()` 已經是 dynamic import，沿用即可。

### 2.3 紀錄：`agent.prompt_screen`

這張表是「偵測」功能的本體，分類器只是訊號來源。與其他 agent 表一樣用 `agentSchema.table`（`packages/db/src/schemas/agent.schema.ts`），repo 加在 `packages/db/src/libs/agent/index.ts`（`@chia/db/repos/agent`）。

```text
agent.prompt_screen
  id            uuid pk
  user_id       text  fk user.id
  session_id    text  fk agent.session.id
  kind          text
  verdict       enum  allow | block
  reason        enum  injection | harmful | null
  signals       jsonb PromptScreenSignal[]     (JsonObject from @chia/utils/json)
  text_hash     text  sha256；不存原文
  text_length   int
  created_at    timestamptz
  index (user_id, created_at), index (verdict, created_at)
```

- `allow` 也寫。沒有 allow 的基線就看不出 block 率，也看不出分類器對正常使用者的 false positive。
- **不存原文**。存 hash 足夠比對重送與同文多人試探；原文留在 `agent.session_entry`（allow 的話）或根本不留（block 的話）。這是資料最小化，也避免這張表變成有害內容的倉庫。
- 寫入與 `block` 的 throw 在同一個 try：紀錄失敗不能讓 block 變 allow，反過來也一樣——紀錄失敗就讓 request 以 500 結束。
- 這是泛型 service 的行為，不是 kind 的：只要 `definition.screen` 存在，`prompt()` 就負責寫紀錄。kind 只提供判定。

### 2.4 Contract 與 route

- `chatAgentContract.errors` 新增 `PROMPT_REJECTED: { data: z.object({ reason: z.enum(["injection", "harmful"]) }) }`。一個 reason 給 client 選文案用，不回 score、不回 signals——回得越多，試探者學得越快。
- `chatAgentRoute` 的 `prompt` 與 `command` 分支包一層：`catch (e) { if (e instanceof PromptRejectedError) throw opts.errors.PROMPT_REJECTED({ data: { reason: e.reason } }); throw e; }`。service 內其他 `throw new Error(...)` 的慣例不動。
- `text: z.string().min(1)` 兩處（`prompt` 與 `command`）補上 `.max(4000)`。這是最便宜的一層；writing kind 也適用。
- `@chia/agent-elements` 的 composer 收到 `PROMPT_REJECTED` 時保留輸入、顯示一句不帶指責的提示（`labels` 加 `promptRejected.injection` / `.harmful`，`packages/i18n/agent-elements/{en-US,zh-TW}.json` 同步）。不清空 session、不動 store——因為什麼都沒發生。

### 2.5 偵測的消費端

第一版只要 `dash` 有一頁能看：按 `verdict` / `reason` 篩、按 user 聚合最近 24h 的 block 次數、點開看 `signals`。

依 §2 的規則「一個 kind 才有的 procedure 用自己的 namespace」——但這個 list 不屬於任何 kind，它是跨 kind 的 operator 視角，所以是 `agent.screens.list`（`minTier: Root`，走 `callerGuard` + `adminPolicy`，不經 `agentKindGuard`），contract 放 `packages/api/orpc/contracts/agent.contract.ts` 的 `screens` 子樹，handler 直接讀 repo，不經 `AgentKindService`。自動封鎖等有資料再說（§0 非目標）。

### 2.6 Env

`apps/service/src/env.ts`：

- `HF_TOKEN: z.string().min(1)` — 新增；用 fine-grained token，只給 inference 權限。
- `OPENAI_API_KEY` — 目前 `optional()`。改成 `.min(1)` 必填最直接；`packages/ai` 也讀它，要先確認沒有「沒 key 就走別的 provider」的路徑依賴 optional 語意。

`.env.example`、`turbo.json` `globalPassThroughEnv`、Railway 變數同步。

## 3. 與其他防線的關係

| 防線                         | 擋什麼                    | 在哪                                        | 狀態                            |
| ---------------------------- | ------------------------- | ------------------------------------------- | ------------------------------- |
| `text.max(4000)`             | 超長 prompt               | contract                                    | 本計畫                          |
| **本計畫 screening**         | injection 句型、有害內容  | `prompt()`，本地檢查之後、enqueue 之前      | 本計畫                          |
| per-user 配額                | 長期濫用、成本            | `prompt()`，screening 之後、enqueue 之前    | 待開 issue，與 public kind 一起 |
| per-turn budget              | 單輪失控 loop、wall-clock | Pi `tool_call` hook（`createPiTurnBudget`） | 已上（#3001 / #3004）           |
| port visibility / no WebPort | 越權、exfiltration        | definition 的 `runTurn` 建 port 時          | 既有                            |

順序上 screening 在配額之前：被擋的 prompt 不該吃掉使用者的額度。

## 4. 測試

- `prompt-screen.port`：mock 兩個 HTTP endpoint；驗證門檻、chunking、並行、單一失敗 fail-open 並帶 `error` signal、雙失敗告警、timeout。一組固定的 fixture prompts（中英各幾則 benign / injection / harmful）用錄下的分類器回應——不打真 API。
- `createAgentKindService`（`apps/service/__tests__`）：以一個帶 `screen` 的 fake definition 驗證 `block` 時不呼叫 workflow start / hook resume、寫了一筆紀錄、throw `PromptRejectedError`；`allow` 時紀錄一筆且流程不變；`screen` 未定義時不寫紀錄。
- `chatAgentRoute`：`PromptRejectedError` 映射到 `PROMPT_REJECTED` 且 `data.reason` 正確。
- `@chia/agent-elements`：composer 對 `PROMPT_REJECTED` 保留輸入；labels 測試確認兩個 locale 都有新 key。

## 5. Phases

| Phase                                | 內容                                                                                                                  | 可獨立交付                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Phase 1：contract、schema、port 型別 | `text.max`、`PROMPT_REJECTED`、`agent.prompt_screen` 表與 migration、repo、`PromptScreenPort` / `PromptRejectedError` | 是（無行為改變）                    |
| Phase 2：泛型 service 接線           | `AgentKindDefinition.screen?`、`prompt()` 的 screen → record → enqueue、route 映射、service 測試                      | 是（writing 無 `screen`，行為不變） |
| Phase 3：host port                   | `prompt-screen.port.ts`、env、port 測試                                                                               | 是                                  |
| Phase 4：public kind 掛上            | public definition 設 `screen`；composer / i18n 錯誤處理                                                               | 與 public kind 本體一起             |
| Phase 5：偵測頁                      | `agent.screens.list` + dash 列表                                                                                      | 是                                  |

Phase 1–3 可以在 public kind 存在之前先合併；Phase 4 是 public kind PR 的一部分。

## 6. 會動到的檔案

```text
新增
  packages/api/orpc/services/prompt-screen.ts               port 型別、PromptRejectedError
  apps/service/src/services/prompt-screen.port.ts           HF + OpenAI 實作
  apps/service/__tests__/prompt-screen.port.test.ts
  apps/dash/src/components/agent/screen-log.tsx

修改
  apps/service/src/agents/kind.ts                           AgentKindDefinition.screen?
  apps/service/src/agents/service.ts                        prompt() 的 screen → record → enqueue
  apps/service/src/agents/<public>.ts                       設 screen（隨 public kind 新增）
  apps/service/__tests__/agent-service.test.ts              fake definition 帶 screen
  packages/api/orpc/contracts/agent.contract.ts             text.max、PROMPT_REJECTED、screens.list
  packages/api/orpc/routes/agent.route.ts                   PromptRejectedError → PROMPT_REJECTED；screens.list
  packages/db/src/schemas/agent.schema.ts                   agent.prompt_screen
  packages/db/src/libs/agent/index.ts                       recordPromptScreen、listPromptScreens
  packages/db/.drizzle/                                     migration
  apps/service/src/env.ts, .env.example, turbo.json         HF_TOKEN、OPENAI_API_KEY
  packages/agent-elements/src/composer.tsx, labels.ts       PROMPT_REJECTED 文案
  packages/i18n/agent-elements/{en-US,zh-TW}.json
  docs/agent-architecture.md, .zh.md                        §2 definition 成員、§4 enqueue 流程、§12 reference
```

## 7. 待確認

1. **fail-open**（§2.2）——接受「分類器掛掉時放行」，還是寧可 fail-closed 讓 public agent 暫停？
2. **Prompt Guard 門檻 0.8**——Meta 建議值附近；上線後用 `agent.prompt_screen` 的分佈調，這裡只要同意起點。
3. **HF Inference 作為 injection 分類器的供應商**——多一個 HF token 在 Railway 上。若不想多供應商，替代是 in-process ONNX（§1）。
4. `OPENAI_API_KEY` 改 required 會不會影響 `packages/ai` 現在的 provider 解析。
