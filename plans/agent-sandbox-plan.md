# Agent Sandbox 整合計劃

> 狀態：提案，尚未實作
> 建立日期：2026-08-20
> 最後更新：2026-08-20
> 範圍：新 package `@chia/agent-sandbox`、`@chia/agent-writing` 的 tool set 與 policy、`apps/service` 的 host port 與 env
> 前置：`docs/agent-architecture.md`（port / policy / approval 的既有不變量）

## 0. 目的與非目標

讓 agent 取得「執行程式碼」這個能力，同時保證**即使模型被 prompt injection 完全控制，最壞後果也只是燒掉一點 sandbox 配額**——碰不到 `service` 的 process、憑證、DB 與內網。

這份計畫只做方向與邊界，不決定第一個使用情境的 prompt 細節。預期的第一個消費者是 writing kind：驗證文章裡的程式片段能跑、產生範例輸出、跑一段小腳本整理資料。

**非目標**

- 不做 public kind 的程式碼執行。public kind 的使用情境（問部落格內容）用不到，不給就是最好的 sandbox；`minTier: Session` 的 kind 不會 compose 這組 tools。
- 不做 persistent workspace、不做 preview URL、不做 git clone 進 sandbox。這些是之後疊上去的能力，本計畫只留 seam。
- 不在 `service` process 內執行任何東西（`node:vm`、`isolated-vm`、worker thread、本機 Docker 一律排除，理由見 §1）。

## 1. 威脅模型與安全不變量

出發點與 `docs/agent-architecture.md` §10 的 content visibility 一致：**權限在 host 建 port 時固定，模型只拿到 capability**。prompt injection 防不住，所以設計目標是讓「模型被說服去跑惡意程式碼」這件事的後果被結構性地限制住。

| 不變量                                                           | 由誰保證                                                                |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 程式碼只在 `service` 之外的一次性 microVM 執行                   | host port 實作只呼叫遠端 Sandbox API，package 內沒有任何本機執行路徑    |
| sandbox 內沒有任何 `service` 的憑證、env、內網位址               | `Sandbox.create` 不傳 `env`；port 型別上沒有 env 參數，模型無法塞       |
| egress 預設 `deny-all`                                           | `networkPolicy` 在 port 建構時固定，不是 tool 參數                      |
| 每個 command 有硬 timeout、每個 sandbox 有硬 TTL、輸出有大小上限 | port 實作的常數，不可由模型覆蓋                                         |
| 每個 session 的執行次數有上限                                    | port 在 turn context 裡計數，超額回 tool error                          |
| sandbox 的 stdout/stderr 回到模型時只是資料，不是指令            | tool result 只經 `textResult` 包裝；這點與 `fetch_url` 的處境相同       |
| 只有 writing kind 掛這組 tools                                   | tool set 是 kind 自己 compose；public kind 的 `run<Kind>Turn` 不建 port |

為什麼不在 process 內跑：`node:vm` 不是安全邊界（Node 官方文件明寫），`isolated-vm` 擋得住 JS 逃逸但擋不住 CPU/記憶體耗盡與同 process 的 side channel，而任何 in-process 方案都跟 `DATABASE_URL`、`AI_GATEWAY_API_KEY`、Redis 共用同一張網卡——一個 SSRF 就全拿走。在 Railway 的 service 旁邊起 Docker container 也一樣，它共享 Docker socket 與內網。

## 2. 執行環境選型：Vercel Sandbox

候選是 Vercel Sandbox、E2B、Cloudflare Sandbox SDK。Cloudflare 的要在 Worker 內使用，`service` 是 Railway 上的 Nitro，不適用。Vercel Sandbox 與 E2B 都是 Firecracker microVM、按次建立、可關 egress。選 **Vercel Sandbox**（`@vercel/sandbox`）：

- repo 已在 Vercel 生態內（AI Gateway、Workflow SDK、`apps/www`），少一個供應商與帳單。
- 原生支援 `networkPolicy: "deny-all" | "allow-all" | custom(allowedDomains/CIDRs)`，是本計畫最需要的開關。
- `runtime: node24 | python3.13`、`resources.vcpus`、`timeout`、`Sandbox.get({ sandboxId })` 重新連線，都足夠。
- 從 Vercel 之外呼叫用 `VERCEL_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID` 認證，`service` 在 Railway 上可用。

代價：多一組 Vercel token 放在 Railway 的 service 上；token 權限要限縮到該 project。若之後發現 Vercel Sandbox 的限制（例如 region 或 runtime 清單）不合用，換成 E2B 只動 `apps/service/src/services/agent-sandbox.port.ts` 一個檔案——這就是 port 要放在那裡的原因。

## 3. 架構

### 3.1 package 切分

依 `@chia/agent-content` 的前例：**可被多個 kind 共用的 tools 自成 package，帶自己的 port 型別、tool 名稱、label 與 summary；host 實作 port**。

```text
packages/agent-sandbox/                 新 package，@chia/agent-sandbox
  src/types.ts                          SandboxPort、SandboxToolContext、輸入輸出型別
  src/tools/registry.ts                 SANDBOX_TOOL_NAMES、SANDBOX_TOOL_LABEL_BY_NAME
  src/tools/run.tool.ts                 run_command、write_file、read_file
  src/tools/summarize.ts                tool:end 的 summary
  src/testing/fake-port.ts              測試用 FakeSandboxPort（記錄呼叫、可注入輸出）

apps/service/src/services/agent-sandbox.port.ts   @vercel/sandbox 實作
```

`exports` 照慣例一 key 一 module（`./types`、`./tools/run`、`./tools/registry`、`./tools/summarize`、`./testing/fake-port`），不開 root entry。`@vercel/sandbox` 版本進 `pnpm-workspace.yaml` 的 `catalog:agent`。

### 3.2 SandboxPort

```ts
export interface SandboxPort {
  /**
   * 取得本 turn 的 sandbox；第一次呼叫才真的建立。
   * 同一個 turn 內的多次 tool call 共用同一個 sandbox，turn 結束由 host 銷毀。
   */
  open(): Promise<SandboxHandle>;
}

export interface SandboxHandle {
  runCommand(
    input: {
      cmd: string;
      args?: string[];
      cwd?: string;
      /** 硬上限由 port 夾住，這裡只能往下調 */
      timeoutMs?: number;
    },
    signal: AbortSignal
  ): Promise<CommandResult>;
  writeFiles(files: { path: string; content: string }[]): Promise<void>;
  readFile(path: string): Promise<string | null>;
}

export interface CommandResult {
  exitCode: number;
  stdout: string; // 已截斷
  stderr: string; // 已截斷
  truncated: boolean;
  durationMs: number;
}
```

port 上**沒有** `env`、`networkPolicy`、`runtime`、`resources` 這些欄位——它們是 host 建 port 時的常數，型別上不讓 tool 層碰。`runtime` 暫時固定 `node24`；需要 Python 時再加一個 port option，不是 tool 參數。

### 3.3 生命週期：per-turn

一個 turn 就是一個 `runAgentTurnStep`，Pi harness 整個活在這個 step 裡（`docs/agent-architecture.md` §4）。所以 sandbox handle 可以是 step 內的記憶體物件，不需要持久化：

```text
runWritingAgentTurn
  ├─ const sandbox = createAgentSandboxPort({ signal })     // lazy，不建 VM
  ├─ runWritingTurn({ ..., sandbox })
  │     └─ 模型第一次呼叫 run_command → port.open() → Sandbox.create()
  │        之後同 turn 的呼叫共用同一個 handle
  └─ finally: await sandbox.dispose()                        // Sandbox.stop()
```

- **abort**：`runPiTurn` 拿到的 host `AbortSignal` 一併傳進 port；signal 觸發時 `stop()` sandbox，正在跑的 command 以 aborted 收尾。
- **step 失敗 / process 重啟**：`dispose` 跑不到時靠 `Sandbox.create({ timeout })` 的 TTL 自動回收，TTL 設短（10 分鐘）。這是 Vercel 端的保證，不靠我們的 cleanup。
- **跨 turn 保留檔案**（例如上個 turn 寫的腳本這個 turn 繼續改）是明確的下一個能力：把 `open()` 改成讀 `writing_agent_session.sandboxId` 並 `Sandbox.get()`，或用 snapshot。seam 就在 `open()` 這一個方法上，本計畫不做。

### 3.4 Tools

| Tool          | 參數                                 | 說明                                                                      |
| ------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| `write_file`  | `path`, `content`                    | 寫進 sandbox 的工作目錄；path 被 port 正規化並限制在 `/vercel/sandbox` 下 |
| `run_command` | `cmd`, `args?`, `cwd?`, `timeoutMs?` | 執行一個指令；stdout 透過 `onUpdate` 串流成 `tool:update`                 |
| `read_file`   | `path`                               | 讀回結果檔（模型寫檔、跑腳本、讀輸出這條最小閉環）                        |

三個都 `executionMode: "sequential"`——它們共享一個 sandbox 且有順序依賴，與 content read tools 的 `parallel` 不同。

`run_command` 的 `onUpdate` 串流走既有的 `tool:update` wire event，`tool:end.details` 照舊被 `clipDetails` 截斷；模型讀的是 `content`（已由 port 截斷到上限），不是 details。

### 3.5 Policy：新 tier `execute`

writing 現有三個 tier：`read` / `draft` / `commit`。程式碼執行不屬於任何一個：它不讀內容、不改 draft、不寫 live data。新增 tier `execute`：

| Tier      | Approval | `state:changed` | 理由                                                                             |
| --------- | -------- | --------------- | -------------------------------------------------------------------------------- |
| `execute` | **no**   | no              | 安全邊界是 sandbox 本身（§1），不是 operator；逐次 approval 只會讓這個能力沒人用 |

這是計畫裡最需要被你確認的決定。另一個選項是 `requiresApproval: true` 觀察一陣子再放開——但「先嚴後鬆」在這裡沒有資訊價值：approval 防的是不可逆的副作用，而 `deny-all` + 無憑證 + TTL 的 sandbox 沒有不可逆副作用，剩下的只有成本，成本用配額管（§3.6）。

`tierOf` 的 unknown fallback 仍是 `commit`，不受影響。

### 3.6 配額與上限

全部是 host port 的常數，之後要調再改：

| 項目                    | 值       | 由誰 enforce                                                          |
| ----------------------- | -------- | --------------------------------------------------------------------- |
| sandbox TTL             | 10 min   | `Sandbox.create({ timeout })`                                         |
| 單一 command timeout    | 60 s     | port 夾住 `timeoutMs`，超時 `kill`                                    |
| vCPU                    | 1        | `resources.vcpus`                                                     |
| stdout + stderr 上限    | 16 KB    | port 截斷，`truncated: true`                                          |
| 每 turn command 次數    | 20       | port 計數，超額 tool error                                            |
| 每 session command 次數 | 100      | `writing_agent_session.sandboxCommandCount`（唯一需要的 schema 改動） |
| egress                  | deny-all | `networkPolicy`                                                       |

`allowedDomains: ["registry.npmjs.org"]` 這類放寬是預期中的第一個需求（模型想 `npm install`），但要等真的需要再開，而且只開 registry，不開 `allow-all`。

### 3.7 Env

`apps/service/src/env.ts` 新增 `VERCEL_TOKEN`、`VERCEL_TEAM_ID`、`VERCEL_PROJECT_ID`（三個都 `z.string().min(1)`），`.env.example` 與 Railway 變數同步；`turbo.json` `globalPassThroughEnv` 加入。token 用 Vercel 的 project-scoped token，不是個人 full-access token。

`@vercel/sandbox` 的 client 與 Firecrawl 一樣在 module scope 建構，所以 `agent-sandbox.port` 也走 dynamic import，留在 `runWritingAgentTurn` 的 `Promise.all` 裡，不進 boot path。

## 4. Prompt 與 skill

system prompt 是 session 穩定的（§4 prompt layering），加一段 `execute` 的 posture：sandbox 是一次性的、沒有網路、輸出會被截斷、turn 結束檔案就消失。具體「什麼時候該跑程式碼」寫成一個 skill（`packages/agent-writing/src/prompts/skills/verify-code.md` 之類），模型用 `read_skill` 載入，與現有 skill 機制一致。

## 5. 測試

- `@chia/agent-sandbox`：tools 對 `FakeSandboxPort` 的單元測試（參數正規化、path 限制、截斷旗標透傳、`onUpdate` 串流）。
- `@chia/agent-writing`：policy 測試加 `execute` tier 的 `requiresApproval === false`、`changesState === false`；tool set 測試確認三個 tool 進了 writing 的 set。
- `apps/service`：`agent-sandbox.port` 對 `@vercel/sandbox` 做 mock，驗證 `create` 的固定參數（`deny-all`、無 `env`、TTL）、timeout 夾住、輸出截斷、per-turn 計數、abort 時 `stop`。這組測試就是 §1 不變量的守門員。
- 不做 e2e 打真 sandbox；留一個 `scripts/` 的手動 smoke script。

## 6. Phases

| Phase                      | 內容                                                                                                              | 可獨立交付                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Phase 1：package 與 port   | `@chia/agent-sandbox` 的 types、registry、tools、fake port；不接任何 kind                                         | 是（純 lib）                  |
| Phase 2：host 實作         | `agent-sandbox.port.ts` on `@vercel/sandbox`、env、catalog、port 測試                                             | 是                            |
| Phase 3：接進 writing kind | tier `execute`、tool set、policy、prompt posture、turn step 的 lazy port 與 dispose、session 計數欄位與 migration | 是——這一步完成才算 end to end |
| Phase 4：文件              | `docs/agent-architecture.md` §3 tier 表、§10 port 清單、§12 reference 更新                                        | 是                            |

Phase 1–3 可以在同一個 PR，但 Phase 3 之前 `service` 不會有任何新行為，所以拆開 review 也不會留下半成品。

## 7. 會動到的檔案

```text
新增
  packages/agent-sandbox/**                                    package 本體
  apps/service/src/services/agent-sandbox.port.ts              host 實作
  apps/service/__tests__/agent-sandbox.port.test.ts
  packages/agent-writing/src/prompts/skills/<verify-code>.md

修改
  pnpm-workspace.yaml                                          catalog:agent 加 @vercel/sandbox
  apps/service/src/env.ts, .env.example, turbo.json            三個 VERCEL_* 變數
  apps/service/src/steps/agent-turn.step.ts                    建 port、傳 signal、finally dispose
  packages/agent-writing/src/ports.ts                          re-export SandboxPort
  packages/agent-writing/src/tools/registry.ts                 名稱、tier、label
  packages/agent-writing/src/tools/tool-set.ts                 compose 三個 tool
  packages/agent-writing/src/policy.ts                         execute tier
  packages/agent-writing/src/runtime.ts                        tool context 帶 sandbox
  packages/agent-writing/src/prompts/system.ts                 execute posture
  packages/db/src/schemas/agent.schema.ts                      writing_agent_session.sandboxCommandCount
  docs/agent-architecture.md, docs/agent-architecture.zh.md
```

## 8. 待確認

1. **`execute` tier 不需 approval**（§3.5）——同意這個判斷，還是要先 `requiresApproval: true`？
2. **Vercel Sandbox vs E2B**（§2）——是否接受再放一組 Vercel token 到 Railway 上。
3. **per-turn 生命週期**（§3.3）——第一版不保留跨 turn 的檔案，確認這對 writing 的使用情境夠用。
4. `VERCEL_PROJECT_ID` 指向哪個 Vercel project：用 `apps/www` 的，或為 sandbox 另開一個空 project 隔離帳單與 token 權限（建議後者）。
