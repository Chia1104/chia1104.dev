# Pi-first Agent 架構收斂計劃

> 狀態：已實作；pending subsystem 已於 follow-up 收斂為 Workflow Hook-only
> 建立日期：2026-08-14
> 最後更新：2026-08-14
> 範圍：`@chia/agent-core`、`@chia/agent-runtime`、`@chia/agent-writing` 與 service 端 agent turn／maintenance 接線
> 前置：`docs/agent-architecture.md`（現行架構與 durable invariants）

## 0. 執行狀態

| Phase                                            | 狀態    | 目的                                                          |
| ------------------------------------------------ | ------- | ------------------------------------------------------------- |
| Phase 0：行為基線與缺口測試                      | ✅ 完成 | 已鎖住 approval、hook queue、event、compaction 等核心行為     |
| Phase 1：移除 harness-neutral engine abstraction | ✅ 完成 | 已收斂為 `runWritingTurn → runPiTurn → AgentHarness` 單一路徑 |
| Phase 2：移除 maintenance fake handle            | ✅ 完成 | 已改用具體 compact／navigate operations                       |
| Phase 3：合併 `agent-core` 與 `agent-runtime`    | ✅ 完成 | package 與測試已搬移，未保留 compatibility package            |
| Phase 4：命名、exports、文件與 dead-code cleanup | ✅ 完成 | host port 與文件已更新，舊 execution path 已刪除              |
| Phase 5：Workflow Hook-only message inbox        | ✅ 完成 | 已刪除 steer、pending table、Redis notifier 與 polling        |

### 0.1 實作紀錄

- Production turn path 已是 `runAgentTurnStep → runWritingTurn → runPiTurn → AgentHarness`。
- `AgentEngineHandle`／factory／adapter 與 maintenance fake handle 已直接刪除。
- `@chia/agent-core` 已併入 `@chia/agent-runtime`；原有五組 core tests 全數搬移。
- API host port 已改名為 `AgentKindService`，host implementation 改為
  `writingAgentService`，啟動註冊函式改為 `registerAgentKindServices`。
- 追加訊息已統一走 reusable `agentMessageHook` 的 durable event log。Workflow 在首個 turn 前
  透過 `getConflict()` 註冊 inbox；訊息依序成為後續 turn，不再 mid-turn steer。
- `agent_pending_message`、`PendingMessageStore`／`PendingMessageNotifier`、Redis Pub/Sub
  notifier、polling/drain logic 與 steer API 已直接刪除；Drizzle migration 會直接移除舊表。
- `agent_session.kind`、API service Map 與 workflow handler Map 本次保留。這是 persisted domain
  dispatch，不是 harness abstraction；移除它會同時改 API/schema，超出本計劃的 execution
  refactor 範圍。沒有為它新增 descriptor、plugin 或 capability framework。
- Scoped 驗證：`@chia/agent-runtime` 45 tests、`@chia/agent-writing` 32 tests 通過；runtime、
  writing、API、service、dash TypeScript checks 通過。
- Root 驗證：54 test files 通過（310 passed、2 skipped）；18 個 typecheck tasks 與 18 個 lint
  tasks 通過；完成最終 wire module 拆分後，runtime、writing、API、service 的直接 TypeScript
  checks 與修改範圍 lint 亦通過；service Nitro build 通過。Service build 仍輸出既有的
  dependency source-map 與 JSX config warnings，但 exit code 為 0。
- 本計畫新增／修改的可格式化檔案通過 `oxfmt --check`。Root `format:check` 仍被 13 個
  本次範圍外、原本就未符合 oxfmt 的檔案擋住（包含 `AGENTS.md`、既有 app layout/env、AI
  tokenizer tests/source、Drizzle snapshots 與 DB resource/validator files）；未擴大本次變更去
  重寫它們。

---

## 1. 決策摘要

Agent execution 採 **Pi-first concrete runtime**，不再維護「未來可以替換不同 harness」的 engine contract、adapter 與 handle 轉換。

這不代表把 Pi 的所有事件與資料直接送到 client。以下邊界仍然保留：

- Pi event → `AgentWireEvent`：保護 transport 與 UI，不讓完整 model、partial snapshot 或未受控 details 上線。
- Pi `SessionStorage` → Postgres：讓 session tree 延續目前的 durable persistence。
- tool call → approval gate：維持可跨 deploy 的拒絕／批准 handshake。
- domain tools → `ContentPort` / `DraftStore`：維持 domain I/O 可測試且不直接依賴 host。
- workflow step → ordinary runtime code：sandbox workflow 只傳 plain data，DB、provider、timer 仍在 step 中執行。

要移除的是「為第二種 harness 預留、目前沒有第二個實作」的抽象，不是所有 port 或 protocol boundary。

### 1.1 本計劃的預設立場

1. Pi 的 `AgentHarness`、session tree、tool hook、compaction 與 model types 是 agent execution 的基礎能力，可以被程式直接使用。
2. Pi-specific code 用清楚的模組名稱集中，但不再用 generic interface 假裝它與 Pi 無關。
3. 一個完整 turn 只有一條 production path；不保留舊 engine path、compatibility wrapper 或 feature flag。
4. 每個 Phase 結束都必須是可執行、可測試的完整產品狀態。
5. `kind` 是「不同 agent domain」的 discriminant，不是 harness discriminant；本計劃暫不移除它，見 §11。

### 1.2 非目標

- 不更換 durable workflow runtime。
- 不改 approval 的產品語意或 UI。
- 不改 agent session schema、session tree payload 或既有資料。
- 不重寫 writing tools、prompts、skills、model allowlist 或 draft staging。
- 不新增第二種 harness、adapter registry、feature flag 或 compatibility layer。
- 不在這次順便移除 agent `kind`、API runtime registry 或新增第二種 agent kind。

## 2. 現況盤點

### 2.1 文件描述的邊界與實際依賴不一致

目前 `docs/agent-architecture.md` 把架構描述成：

```text
writing domain → engine-neutral runtime → core → Pi adapter
```

但 Pi 已經直接出現在三個 package：

- `packages/agent-core/src/session/pg-storage.ts` 實作 Pi `SessionStorage`。
- `packages/agent-core/src/session/pg-repo.ts` 使用 Pi `SessionRepo` / `Session`。
- `packages/agent-core/src/events.ts` 接收 Pi `AgentHarnessEvent` / `SessionTreeEntry`。
- `packages/agent-core/src/permissions.ts` 接收 Pi tool hook event。
- `packages/agent-core/src/models.ts` 建立 Pi `Models` 與 providers。
- `packages/agent-writing/src/models.ts`、`prompts/*`、`runtime.ts` 使用 Pi types。
- `packages/agent-runtime/src/adapters/pi.ts` 建立真正的 `AgentHarness`。

因此現有 adapter 沒有隔離 Pi；它只把一個 concrete Pi harness 轉成另一組近似 Pi 能力的自訂 handle。

### 2.2 現行 turn 路徑

```text
runWritingAgentTurn (workflow step)
  → writingAgentRuntime.runTurn
    → createAgentRuntime(definition)
      → definition.createEngine
        → createWritingEngine
          → createPiAgentEngine
            → new AgentHarness
```

`AgentDefinition`、`AgentRuntimeFactory` 與 `createAgentRuntime` 只有 writing agent 一個 production consumer。`createAgentRuntime` 又把 `kind`、`createEngine`、`createMaintenanceEngine` 原樣轉交到新物件，沒有形成第二個真正實作。

### 2.3 現行 maintenance abstraction 表達了不存在的能力

`AgentEngineHandle` 同時描述：

- prompt / prompt template
- approval requests
- pending-message drain
- compaction
- navigation
- disposal

`AgentMaintenanceEngineHandle` 又繼承完整 `AgentEngineHandle`。因此 maintenance implementation 必須：

- 讓 `prompt()` / `promptFromTemplate()` 呼叫時丟錯。
- 回傳永遠為空的 `approvalRequests`。
- 讓 `drainPendingMessages()` 永遠回傳 `0`。
- 提供沒有實際工作的 `dispose()`。

這不是 polymorphism，而是 interface shape 與真實 capability 不一致。maintenance 應是具體 operation，而不是假裝成可以執行 turn 的 engine。

### 2.4 `runtime` 名稱有三種不同語意

目前至少有三個同名概念：

1. `packages/agent-runtime`：turn execution 與 Pi adapter。
2. `packages/agent-writing` 的 `writingAgentRuntime`：engine factory + shared turn lifecycle。
3. `packages/api/orpc/agent-runtime.ts` 的 `AgentRuntime`：完整的 host/API operations port。

第三個是有效的 host dependency inversion，但它不是 LLM runtime。Phase 4 會把名稱拆清楚，避免 package execution 與 API service 使用同一個詞。

## 3. 不可破壞的 invariants

這次是結構重整，不是 agent 行為重寫。以下規則優先於檔案數量或行數減少。

### 3.1 Turn lifecycle

1. 每個 turn 建立一個新的 Pi `AgentHarness`，不可跨 session 或 caller 共用。
2. `run:start` 必須先於 user event，`run:end` 必須是該 turn 的最後一個 coarse event。
3. prompt 失敗要轉成 `error` event 與 `{ status: "error" }`，不能讓 event writer 未 flush。
4. 所有 subscriptions 必須解除後才能結束 turn。
5. `flushEvents()` 必須在 harness／subscriptions teardown 後執行，即使 prompt 或 teardown 失敗也一樣。

### 3.2 Approval

1. tool hook 的拒絕仍然是 durable approval handshake，不改成 in-memory promise。
2. approval request 必須先持久化，workflow 才能 park 或 resume。
3. `approvedToolCallIds`、session `autoApprove` 與本 turn `preAuthorizedToolNames` 的判斷順序與語意不變。
4. 有任何 pending approval 時不得 auto-compact。
5. rejection 後的 acknowledge turn 不得被重構吃掉。

### 3.3 Pending messages

本節已由 Phase 5 的 durable inbox 決策取代：

1. Workflow 必須在第一個 turn 前註冊 reusable message hook。
2. Active run 收到的訊息直接成為 durable `hook_received` event。
3. Workflow 依 event-log 順序一次處理一個 turn。
4. Queued message 不打斷目前 Pi step；它在目前 turn 與 approval handshake 後執行。
5. 不保留第二份 Postgres queue、Redis notifier、process-local queue 或 timer polling。

### 3.4 Compaction 與 navigation

1. auto-compaction 只在成功且沒有 pending approval 的 turn 結尾執行。
2. compaction failure 不得讓 turn 失敗。
3. failed turn 不得 auto-compact，保留診斷所需 transcript。
4. manual compact / navigate 在 running turn 期間仍須拒絕。
5. compaction threshold 繼續使用 Pi 的 token estimation 與 `shouldCompact`。
6. navigation 後回傳完整重建 transcript，不能只送增量。

### 3.5 Credentials 與 models

1. `Models` 繼續 per caller / per turn 建立，不能變成 process singleton。
2. model 必須從同一個帶有 caller credentials 的 `Models` instance resolve 並交給 harness。
3. session thinking level 繼續依 resolved model 能力 clamp。
4. writing model allowlist 不變。

## 4. 目標架構

```text
apps/dash
  → oRPC AgentWireEvent / TanStack transport
      → packages/api AgentService port
          → apps/service durable workflow + step + event writer
              → @chia/agent-writing runWritingTurn
                  → @chia/agent-runtime runPiTurn
                      → Pi AgentHarness
                      → PgSessionStorage
```

### 4.1 Package ownership

| 位置                  | 責任                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `@chia/agent-runtime` | Pi harness execution、session persistence、model/provider construction、approval hook、wire mapping、turn lifecycle、transport mapping |
| `@chia/agent-writing` | writing tools、tool context、prompts、skills、templates、model allowlist、tool policy、draft/content ports                             |
| `apps/service`        | DB/KV/credential wiring、workflow、approval audit persistence、durable streams、oRPC service implementation                            |
| `packages/api`        | wire contract、guards、host service port、routes；不建立 harness、不讀 provider env                                                    |
| `apps/dash`           | wire event consumption、history/live fold、agent workspace UI                                                                          |

### 4.2 目標 runtime API

主要 API 是具體的 Pi turn runner，而不是 engine factory：

```ts
runPiTurn({
  harness: {
    session,
    models,
    model,
    tools,
    toolContext,
    systemPrompt,
    resources,
    activeToolNames,
    thinkingLevel,
  },
  policy,
  approvedToolCallIds,
  preAuthorizedToolNames,
  message,
  onEvent,
  toApproval,
  persistApproval,
  flushEvents,
});
```

精確欄位可依 Pi 0.83 的 `AgentHarnessOptions` 收窄，但必須遵守：

- `runPiTurn` 直接建立並操作 `AgentHarness`。
- 不回傳另一個包裝 Pi methods 的長生命週期 handle。
- 不宣告 provider-neutral、harness-neutral 的 engine interface。
- 測試需要替換 provider 行為時，mock Pi module 或 provider stream boundary，不新增第二套 production engine contract。

writing domain 的入口變成：

```ts
runWritingTurn(options): Promise<AgentTurnExecution<AgentApprovalRequestSnapshot>>
```

它負責：

1. 建立 `WritingToolContext`。
2. resolve writing model。
3. 組合 tools、skills、templates、dynamic system prompt 與 `writingPolicy`。
4. 呼叫 `runPiTurn()`。

### 4.3 目標 maintenance API

maintenance 不再建立一個假 engine handle，改成直接 operation：

```ts
compactPiSession(options, customInstructions?)
navigatePiSession(options, entryId, navigationOptions)
```

writing domain 可保留薄但有意義的 model-policy wrapper：

```ts
compactWritingSession(options, customInstructions?)
navigateWritingSession(options, entryId, navigationOptions)
```

這兩個 wrapper 的責任只有用 writing allowlist resolve model；它們不應重新建立 tools、draft store、content port、prompt、approval gate 或 event subscriptions。

## 5. Phase 0：行為基線與缺口測試

重構前先跑現有測試並補齊缺少的 characterization tests。這個 Phase 不改 production behavior。

### 5.1 現有測試要保留的覆蓋

- `packages/agent-runtime/__tests__/runtime.test.ts`
  - prompt / template dispatch
  - error conversion
  - approval collection / persistence
  - teardown 與 flush ordering
  - compaction guards
- `packages/agent-runtime/__tests__/pi-compaction.test.ts`
  - context threshold 與 token estimation
- `packages/agent-core/__tests__/events.test.ts`
  - Pi event → wire event
  - persisted entry → replay event
  - fold live / replay consistency
- `packages/agent-core/__tests__/permissions.test.ts`
  - approval 的四條 allow path 與 unknown-tool fallback
- `packages/agent-writing/__tests__/runtime.test.ts`
  - writing model、tool context、dynamic prompt 與 Pi options 組合

### 5.2 必補測試

若現有測試沒有精確覆蓋，先補以下案例：

1. `persistApproval()` 失敗仍會 teardown subscriptions 並 flush writer。
2. prompt failure 不執行 auto-compaction。
3. approval request 存在時不執行 auto-compaction。
4. compaction failure 不改變成功 turn 的 `done` outcome。
5. template invocation 的 name / args 完整交給 Pi。

### 5.3 Phase 0 驗收

```bash
pnpm turbo run test --filter @chia/agent-core --filter @chia/agent-runtime --filter @chia/agent-writing
pnpm turbo run type:check --filter @chia/agent-core... --filter @chia/agent-runtime... --filter @chia/agent-writing...
```

在任何 production refactor 前記錄通過數，供後續 Phase 對照。

## 6. Phase 1：移除 harness-neutral engine abstraction

### 6.1 新增 concrete Pi turn runner

把 `packages/agent-runtime/src/runtime.ts` 的 turn lifecycle 與 `adapters/pi.ts` 的 harness 建立、subscriptions、approval gate 合成一條 concrete path。

建議先在現有 package 內落成：

```text
packages/agent-runtime/src/
  pi/
    turn.ts
    compaction.ts
    events.ts
    tool-gate.ts
```

Phase 1 暫不搬 `agent-core`，避免「行為收斂」和「package 搬家」同時發生。

`runPiTurn()` 依序負責：

1. clamp thinking level。
2. 建立 Pi `AgentHarness`。
3. 綁定 approval tool hook。
4. 綁定 Pi event → wire event subscription。
5. 綁定 successful state-changing tool result event。
6. emit `run:start` / user event。
7. 呼叫 `prompt()` 或 `promptFromTemplate()`。
8. persist approval snapshots。
9. 依 guard 執行 auto-compaction。
10. emit error / `run:end`。
11. unsubscribe，最後 flush event writer。

### 6.2 Writing entry point

在 `packages/agent-writing/src/runtime.ts`：

- 將 `createWritingEngine()` 改成 `runWritingTurn()`。
- 把現有 tool context、dynamic system prompt、resources 與 model resolution 原樣交給 `runPiTurn()`。
- 不輸出 harness 或 handle 給 service。
- 不再建立 `writingAgentDefinition`。
- 不再呼叫 `createAgentRuntime()`。

在 `apps/service/src/steps/agent-turn.step.ts`：

- `writingAgentRuntime.runTurn({...})` 改為 `runWritingTurn({...})`。
- 保持 DB/KV/content/draft/models/event writer 的建立位置不變。
- 保持 `maxRetries = 0` 的 workflow step 設定不變。
- 保持 approval mapping / persistence 在 host step，runtime 不依賴 DB schema。

### 6.3 刪除項目

完成 production consumer 遷移後直接刪除，不留 deprecated export：

- `AgentEngineCreateOptions`
- `AgentEngineHandle`
- `AgentMaintenanceEngineHandle`
- `AgentDefinition`
- `AgentRuntimeFactory`
- `createAgentRuntime`
- `PiAgentEngineHandle`
- `createPiAgentEngine`
- `WritingEngine`
- `createWritingEngine`
- `writingAgentDefinition`
- package export `@chia/agent-runtime/engine`
- package export `@chia/agent-runtime/adapters/pi`

如果 `packages/agent-runtime/src/engine.ts` 已沒有任何 concrete value，整個檔案刪除。

### 6.4 測試策略

- 把原本 fake `AgentEngineHandle` 的 runtime tests 改為測 `runPiTurn`。
- 優先 mock Pi `AgentHarness` 或 provider stream boundary，不建立 `TestEngine` production abstraction。
- Pi options 組合與 lifecycle orchestration 分開 assertion，但 production 仍只有一條函式路徑。
- 保留至少一個使用 real Pi session + fake provider 的 integration test，避免 mock 與 Pi public API 漂移。

### 6.5 Phase 1 驗收

- `runWritingAgentTurn → runWritingTurn → runPiTurn → AgentHarness` 是唯一 production turn path。
- repo 內搜尋不到 `AgentDefinition`、`AgentEngineHandle`、`createAgentRuntime`、`createPiAgentEngine`。
- prompt、template、approval、drain、error、compaction 的結果與 Phase 0 相同。
- 沒有 compatibility re-export 或舊函式轉呼叫新函式的 fallback。

## 7. Phase 2：移除 maintenance fake handle

### 7.1 Concrete operations

將 `createPiMaintenanceEngine()` 拆成具體函式：

- `compactPiSession()`：建立最小 Pi harness，呼叫 `compact()`，回傳 `{ summary, tokensBefore }`。
- `navigatePiSession()`：建立最小 Pi harness，呼叫 `navigateTree()`，回傳 `{ cancelled }`。
- `compactPiSessionIfNeeded()`：只供 turn end 使用；讀 branch、判斷 threshold、需要時呼叫 compact。

三者共享的只有：

- session
- models
- resolved model
- clamped thinking level
- `tools: []`
- empty system prompt

可以用 module-private helper 建立 maintenance harness，但不得輸出一個同時宣告 prompt、approval、drain 能力的 public handle。

### 7.2 Writing wrappers

將：

- `createWritingMaintenanceEngine()`

改為：

- `compactWritingSession()`
- `navigateWritingSession()`

wrapper 只建立／接收 `Models` 並透過 writing allowlist resolve model，隨即呼叫對應的 Pi operation。

### 7.3 Service wiring

在 `apps/service/src/services/agent-runtime.service.ts`：

- 刪除 `openMaintenanceEngine()`。
- 提取共用但具體的 `openWritingSessionForMaintenance()`，只回傳 `session`、`models`、`settings`；若它沒有讓兩個呼叫點更清楚，則直接 inline。
- `compact()` 直接呼叫 `compactWritingSession()`。
- `navigate()` 直接呼叫 `navigateWritingSession()`，之後照舊從 session 讀 branch 並轉成 replay events。
- 不再有 `try/finally engine.dispose()`；maintenance harness 沒有 subscriptions，不需要假 disposal contract。

### 7.4 Phase 2 驗收

- repo 內不存在「maintenance only」錯誤訊息。
- maintenance code 不宣告、實作或繼承 prompt / approval / pending-message methods。
- manual compact / navigate 的 API response 不變。
- navigation 後的 replay events 與 Phase 0 snapshot 相同。
- BYOK compact 仍使用 caller 自己的 credentials。

## 8. Phase 3：合併 `agent-core` 與 `agent-runtime`

### 8.1 原因

`@chia/agent-core` 目前直接依賴：

- `@chia/db`
- Pi agent core
- Pi AI models/providers
- zod / typebox

它不是無基礎設施依賴的 domain core。`@chia/agent-runtime` 又同時依賴 `agent-core` 和同一組 Pi packages，因此兩個 package 沒有形成可獨立替換或部署的邊界。

合併的目的是減少假 layering，不是把所有程式塞進一個檔案。關注點仍以 modules/subpath exports 分開。

### 8.2 目標檔案配置

```text
packages/agent-runtime/src/
  index.ts
  types.ts                    shared app-level types
  models.ts                   concrete Pi Models/providers
  wire/
    schema.ts                 AgentWireEvent zod schemas + types
    fold.ts                   applyEvent / foldEvents
    replay.ts                 Pi session entries → wire history
  pi/
    turn.ts                   AgentHarness lifecycle
    events.ts                 AgentHarnessEvent → AgentWireEvent
    tool-gate.ts              Pi tool_call approval hook
    compaction.ts
  session/
    index.ts
    pg-storage.ts
    pg-repo.ts
  transports/
    tanstack-ai.ts
```

實際拆檔以 cohesion 為準；不為了對齊目錄圖建立只有 re-export 的空殼。

### 8.3 搬移規則

- `agent-core/src/events.ts` 拆成 stable wire schema/fold 與 Pi-specific mapping/replay。
- `createEventMapper` 改名 `createPiWireEventMapper`，名稱直接承認輸入是 Pi event。
- `entriesToWireEvents` 若繼續接收 Pi `SessionTreeEntry`，放在 `wire/replay.ts` 並在註解說明是 Pi persisted transcript mapping。
- `agent-core/src/permissions.ts` 搬到 `pi/tool-gate.ts`；`AgentPolicy` / approval snapshot 等 app-level types 留在 shared types。
- `agent-core/src/models.ts` 搬到 runtime `models.ts`，不再由名為 core 的 package 隱藏 Pi providers。
- `agent-core/src/session/*` 原樣搬到 runtime session module；這是 concrete Pi-over-Postgres integration。
- Phase 5 已移除 `PendingMessageStore` / `PendingMessageNotifier`；message queue 由 workflow
  backend 的 reusable hook event log 單獨負責。

### 8.4 Dependency / export cleanup

- `@chia/agent-writing` 改成只依賴合併後的 `@chia/agent-runtime`。
- service、API、dash 更新 import paths。
- `packages/agent-core/package.json`、tsconfig、vitest config 與 package directory 最後刪除。
- `@chia/agent-runtime` exports 只暴露實際 consumer 使用的 subpaths。
- 不新增 `@chia/agent-core` compatibility package 或 re-export shim。
- 移除根 vitest/turbo graph 中殘留的 agent-core workspace references。

### 8.5 Phase 3 驗收

- workspace graph 不再有 `@chia/agent-core` package。
- repo 內不存在 `@chia/agent-core` import。
- Pi imports 出現在命名誠實的 runtime / writing modules；不要求為了「看起來隔離」而重新 re-export Pi types。
- `packages/api` 仍不依賴 DB implementation、Pi harness construction 或 provider env parsing。
- 三個原 package 的測試全部搬移並通過，沒有因搬檔刪掉行為測試。

## 9. Phase 4：命名、host port 與文件 cleanup

### 9.1 命名

execution 與 host service 不再都叫 runtime：

| 現名                          | 目標名稱                    |
| ----------------------------- | --------------------------- |
| `writingAgentRuntime.runTurn` | `runWritingTurn`            |
| package `AgentRuntimeFactory` | 刪除                        |
| API `AgentRuntime`            | `AgentKindService`          |
| service `writingAgentRuntime` | `writingAgentService`       |
| `registerAgentRuntimeService` | `registerAgentKindServices` |

API port 保留，因為 `packages/api` 不能 import `apps/service`，而 workflow runtime、DB handles 與 credentials 由 host 擁有。這是有效的 dependency inversion，不屬於要刪除的 harness abstraction。

### 9.2 Optional domain capability

目前 API `AgentRuntime` 用 optional `getDraft?()` 暫時容納 writing domain extension。本計劃不為尚未存在的第二個 kind 設計新 capability framework。

Phase 4 只把 port 改名成 `AgentKindService`，不在 harness refactor 中順便重做 domain route。`getDraft?()` 的去留和 §11 的 kind 決策一起處理：選項 A 會讓它成為 concrete writing service 的必要方法；選項 B 則在第二個 kind 的真實需求已知後，把 base agent operations 與 writing operations 拆成兩個明確 port。現在不新增 `capabilities` union、plugin interface 或 optional-method registry。

### 9.3 文件

更新 `docs/agent-architecture.md` 與中文版：

- layering 從四層改為三層。
- 刪除「Pi 被 adapter 隔離、可被另一個 engine 替換」的敘述。
- 更新 turn flow 為 `runWritingTurn → runPiTurn → AgentHarness`。
- 更新 maintenance、compaction、event mapping 與 reference file paths。
- 保留並重新核對 durable workflow、approval handshake、stream、message inbox 與 statelessness 章節。
- 「Adding a second agent kind」只描述 domain extension，不再提新增 harness adapter。

### 9.4 Dead-code gate

最終搜尋必須為空：

```text
AgentEngineHandle
AgentMaintenanceEngineHandle
AgentDefinition
AgentRuntimeFactory
createAgentRuntime
createPiAgentEngine
createPiMaintenanceEngine
createWritingEngine
createWritingMaintenanceEngine
writingAgentDefinition
@chia/agent-runtime/adapters/pi
@chia/agent-core
```

## 10. 驗證矩陣

### 10.1 自動測試

每個 Phase 至少執行：

```bash
pnpm turbo run test --filter @chia/agent-runtime --filter @chia/agent-writing
pnpm turbo run type:check --filter @chia/agent-runtime... --filter @chia/agent-writing...
pnpm turbo run lint --filter @chia/agent-runtime --filter @chia/agent-writing --filter service
```

Phase 3 搬 package 後再執行 root aggregation：

```bash
pnpm test
pnpm type:check
pnpm lint
pnpm format:check
pnpm build:service
```

### 10.2 行為驗收

| 情境                               | 預期                                                                |
| ---------------------------------- | ------------------------------------------------------------------- |
| 普通 prompt                        | coarse events 與 deltas 持續串流，turn 結束為 `done`                |
| prompt template                    | Pi 收到正確 name / args，wire 上的 user text 與現況一致             |
| provider error                     | emit `error` + `run:end(error)`，writer flush，保留 partial session |
| commit tool 未批准                 | tool 被 Pi hook block、approval request 持久化、workflow park       |
| approval accepted                  | decision 先落 DB，再 resume，下一 turn pre-authorize 正確 tool      |
| approval rejected                  | agent 收到 rejection turn 並能回應 operator comment                 |
| running turn 期間再送 prompt       | payload durable 入 hook event log，依序成為下一個 turn              |
| duplicate active workflow          | `getConflict()` 在首個 turn 前拒絕第二個 inbox owner                |
| successful turn near context limit | turn 結束後 auto-compact，emit `session:compacted`                  |
| pending approval / failed turn     | 不執行 auto-compaction                                              |
| manual compact                     | running turn 時拒絕，idle 時回傳相同 summary/tokensBefore           |
| navigate                           | active leaf 改變並回傳完整 replayed transcript                      |
| BYOK model                         | 使用 caller credential collection，不回退到 house gateway key       |
| reconnect stream                   | coarse replay 與 delta stream cursor 行為不變                       |

### 10.3 結構驗收

- production call graph 沒有 engine factory / adapter handle hop。
- maintenance API 沒有 optional capability 或 unsupported method。
- Pi event 只在 server-side runtime 被轉成 bounded wire event；client 不收到 Pi model object。
- `packages/api` 不直接建立 Pi harness。
- service step 仍是唯一組合 DB、KV、credentials、durable writer 的地方。
- 沒有 compatibility wrapper、dual path 或 obsolete export。

## 11. Agent kind registry 的後續決策

目前有三個和 `kind` 有關的機制：

1. `agent_session.kind` persisted discriminator。
2. `packages/api/orpc/agent-runtime.ts` 的 runtime/service Map。
3. `apps/service/src/steps/agent-turn.step.ts` 的 `AGENT_TURN_HANDLERS`。

這三者是為多種 agent domain（writing、未來可能的其他 kind）服務，與 Pi-first harness 決策正交。為避免一次同時改 execution、wire contract 與 schema，本計劃預設先保留。

Phase 4 完成後做一次明確決策：

### 選項 A：近期確定只有 writing（建議預設）

- 移除 client input 的 `kind`。
- API service registry 改成單一 slot。
- workflow step 直接呼叫 writing handler，不用 handler Map。
- 評估從 session schema 移除 `kind`。
- 第二個 kind 真正出現時，再以當時的差異設計 discriminated union。

### 選項 B：已有明確的第二個 domain agent

- 保留 `kind` 與兩個 host dispatch points。
- 將 string registry 收窄成 shared literal union。
- 每個 kind 提供自己的 service operation 與 turn handler。
- 兩者都使用相同的 concrete `runPiTurn`；不重新引入 harness adapter abstraction。

在沒有第二個 agent 的 concrete requirements 前，不為選項 B 新增更多 descriptor、plugin 或 capability framework。

## 12. 風險與控制

- **event ordering**：原本 lifecycle 與 Pi adapter 分開，合併時最容易改變 subscribe / emit / flush 順序。以 Phase 0 characterization tests 與 durable stream integration test 控制。
- **message ordering**：reusable hook 是唯一 queue；首輪前先 `getConflict()` 註冊，避免 startup
  window 丟失訊息或兩個 runs 同時擁有 inbox。
- **approval audit**：`persistApproval` 的位置與 await ordering 不可改成 fire-and-forget。
- **auto-compaction timing**：必須在 prompt 完成、approval 收集之後，`run:end` 之前維持相同語意。
- **Pi conditional generics**：目前 `AgentHarness` constructor 有一個局部 `as never`。Pi-first 不代表擴大 cast；cast 必須維持在 constructor 的最小範圍，options interface 仍完整 type-check。
- **package merge import churn**：Phase 3 只搬 ownership，不同時改 runtime behavior；先完成 Phase 1/2 並綠燈後才執行。
- **test over-mocking**：全部 mock Pi class 可能讓 public API 漂移而不自知；至少保留一個 real harness integration test。
- **文件漂移**：Phase 4 把 `docs/agent-architecture.md` 當作交付物，不允許程式完成但文件仍描述 adapter architecture。

## 13. 完成定義

本計劃只有在以下條件全部成立時才算完成：

1. production turn path 直接且唯一：`runWritingTurn → runPiTurn → AgentHarness`。
2. generic engine contract、adapter handle 與 factory 全部刪除。
3. compact / navigate 是 concrete operations，沒有 unsupported maintenance methods。
4. `@chia/agent-core` 已合併並刪除，沒有 compatibility package。
5. durable workflow inbox、approval、wire replay、BYOK 與 compaction invariants 全部通過測試。
6. service build、root typecheck、tests、lint、format check 全部通過。
7. `docs/agent-architecture.md` 與中文版已更新成 as-built Pi-first 架構。
8. agent-kind registry 是否保留已有明確記錄；若不在本次移除，不能用它重新引入 harness abstraction。
