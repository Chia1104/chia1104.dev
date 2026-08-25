# Pi 引擎遷移計劃：`AgentHarness` → `Agent`，session tree 收回 `@chia/agent-runtime`

> 狀態：已實作（Phase A、B、C 皆完成）
> 建立日期：2026-08-24
> 最後更新：2026-08-24
> 範圍：`pnpm-workspace.yaml` catalog、`@chia/agent-runtime`（`pi/*`、`session/*`、`tools`、`types`）、`@chia/agent-writing` 的 `runtime.ts` 與測試、`apps/service` 的 `agents/kind.ts`、`agents/service.ts`、`steps/agent-turn.step.ts`、`docs/agent-architecture*.md`
> 前置：`docs/agent-architecture.md` §3「Session tree and tables」、§4「Concrete execution path」、§5、§8；`plans/pi-first-agent-architecture-plan.md`（現行 Pi-first 決策）

## 0. 目的與非目標

把 agent runtime 對 Pi 的依賴從「`AgentHarness` + Pi 的 `Session`/`SessionStorage`/`SessionRepo` 合約」收斂成「`Agent` class 跑一個 turn 的 provider loop 與工具執行；session tree、compaction、navigation、fork 由 `@chia/agent-runtime` 擁有」。做完之後：

1. `@earendil-works/pi-ai` 可以隨時升級（目前 0.83.0 → 0.84.3 零 breaking）。
2. `@earendil-works/pi-agent-core` 升到 0.84.x 變成機械式 bump，不再被上游 harness 重寫進度阻塞。
3. 「真相在 Postgres、每 turn 一個實例」的既有不變式不變，而且持久化時機明確在自己手上。

**非目標**

- 不實作 0.84.3 的 v4 `SessionStorage`（lanes / records / facts）Postgres 後端。上游規格已把該合約標為「原地重做」，現在寫會白工，見 §1。
- 不做 mid-turn steer / followUp。durable inbox 在 turn 邊界消費的設計不變（§7 durable message inbox）。
- 不引入 harness adapter、engine factory 或第二種引擎的抽象；引擎就是 Pi 的 `Agent`，命名照舊用 `pi/*`。
- 不改 `agent.session` / `agent.session_entry` 的 schema。entry payload 本來就是 opaque JSON，這次遷移沒有 migration。

## 1. 現況與上游狀態（2026-08-24 查證）

### 1.1 專案依賴面

- catalog `agent`：`@earendil-works/pi-agent-core: 0.83.0`、`@earendil-works/pi-ai: 0.83.0`；三個 package 直接依賴（`agent-runtime`、`agent-writing`、`agent-content`）。
- `pi-ai` 只用到 `createModels`、`InMemoryModelsStore`、內建 provider（anthropic / openai / vercel-ai-gateway / faux）、`StringEnum`、`contentText`、`isContextOverflow`、`clampThinkingLevel` 與型別。0.84 的四個 breaking change（`ModelsStreamTransforms` 改名、`refreshModels` 的 `context.store` → `publish()`、provider auth 必須接 abort signal、`GoogleThinkingLevel` 改名）都碰不到專案程式碼。
- `pi-agent-core` 是重災區：`pi/turn.ts` 與 `pi/maintenance.ts` 建 `AgentHarness`，`session/pg-storage.ts` 實作 0.83 的 12 方法 `SessionStorage`，`session/pg-repo.ts` 實作 `SessionRepo` 並用 `toSession` / `getEntriesToFork` / `createTimestamp`，`pi/events.ts` 切 `AgentHarnessEvent`，多處切 `SessionTreeEntry`。

### 1.2 上游 0.84.x 的實情

| 項目                                          | 0.83.0                                                                                      | 0.84.3（= main HEAD）                                                                                                                                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AgentHarness`                                | 1084 行完整實作，內部呼叫 `runAgentLoop`，在 `message_end` 把訊息 `session.appendMessage()` | 508 行 scaffold：`prompt` / `promptFromTemplate` / `compact` / `navigateTree` / `abort` / `steer` / `waitForIdle` / `hooks.on` / `events.on` 全部 reject `HarnessNotImplemented`；`create()` 遇到有 record 的 session 丟 `create.restore` |
| session 合約                                  | `SessionStorage`（leaf / label entry / `getPathToRootOrCompaction`）+ `Session` class       | v4 lane-based：`getLanes` / `appendEntry(entry, lane)` / `appendRecord` / `findOpenOperations` / `getLog` / name、label 改為 fact                                                                                                         |
| `SessionTreeEntry`                            | 11 種 entry                                                                                 | 改名 `Entry`，7 種；`label` / `session_info` / `leaf` 不再是 entry                                                                                                                                                                        |
| 事件                                          | `AgentHarnessEvent`（`message_*`、`tool_execution_*`、`session_compact`…）                  | `HarnessEvent` 只剩 `run_start` / `run_end`                                                                                                                                                                                               |
| `Agent` class（`agent.ts` + `agent-loop.ts`） | 完整                                                                                        | 完整，1388 行；`pi-coding-agent` 0.84.3 的 `core/sdk.ts` 就是 `new Agent({...})` 配自己的 `SessionManager`                                                                                                                                |

`packages/agent/docs/harness.md`（2941 行實作規格）Part 8 build order 列 16 個 slice；R1–R12 runtime slice 一個都沒開始，而且 slice 1 明寫「`packages/agent/src/harness/**` 全部刪掉重來」、§1.7 明寫「source tree 裡的 v4 code 未完成，原地替換」。0.84.0（8/6）到今天 harness 檔案零變動。

### 1.3 推論

- 不能升 `pi-agent-core` 到 0.84.x：production path 一個 turn 都跑不完。
- 不該對 0.84.3 的 `SessionStorage` 寫 PG 後端：合約本身將被替換。
- 上游自己在生產跑的引擎是 `Agent`。`Agent` 不認識任何 session 型別，只吃 `initialState.messages: AgentMessage[]` 並以事件吐出結果；0.83 harness 對它做的事只是：從 `Session` 投影 messages、在 `message_end` 寫回、把 hook 轉接。那層 plumbing 搬進 `agent-runtime` 就是本計劃。

## 0.1 實作紀錄（2026-08-24）

- Phase A：`pi-ai` 0.84.3 先以 pnpm `overrides` 壓平巢狀依賴進場，三個 agent package 與 service 的 type:check 與測試不動即過。
- Phase B：`runPiTurn` 改建 `Agent`；`session/entries.ts`（`SessionEntry`）、`session/tree.ts`（`SessionTree`、`InMemorySessionTree`）、`session/context.ts`（`buildBranchContext`）新增；`PgSessionStorage` / `PgSessionRepo` 不再實作 Pi 介面；`session/pi.ts` 刪除；compaction / navigation / fork 由 `pi/compaction.ts`、`pi/maintenance.ts`、`pg-repo.ts` 自己驅動。`runtime.test.ts` 改用真的 `Agent` + faux provider；新增 `session-context`（投影 byte-equality）、`pi-maintenance`、`pg-repo` 測試。
- Phase C：`pi-agent-core` 升 0.84.3，移除 override。`SessionEntry` 沒有 0.84.3 `Entry` 的 storage-assigned `seq`，所以投影、compaction、branch summary 三處的 `as never` cast 保留，SAFETY 註解標明理由；`hardMaxToolCalls` 的拒絕加上 `terminate: true`。
- Review 後調整：`appendEntry` 的 insert 與 leaf 推進改為單一交易（`appendAgentSessionEntryAsLeaf`）；compaction entry 的 parent 是被總結那條 branch 的 leaf，不是事後重讀的 leaf；navigation 的共同祖先改走完整 parent chain（branch 會停在 compaction，跨 compaction rewind 時會把共享歷史也拿去總結）；整棵樹 fork 明確沿用來源 leaf；`getEntries` 拿掉沒有人用的 `afterSeq`/`limit`；maintenance 可接 `signal`。
- 與計劃的差異：`pg-repo.ts` 的 not-found 用自己的 `SessionNotFoundError` 而非 `AppError`——`agent-runtime` 不依賴 `service-kit`，為一個錯誤類別加依賴不值得；fork 沿用 0.83 `getEntriesToFork` 的語意（複製到最近一次 compaction 為止），因此 `SessionTree` 沒有 `getPathToRoot`，而是 `getBranch(fromId?)`；label 在 navigate 時會落盤但不成為 leaf。

## 2. 決策摘要

三個 phase，順序固定：

| Phase | 內容                                                                                                                                                           | 相依       |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A     | `pi-ai` 升 0.84.3；`pi-agent-core` 留 0.83.0，用 pnpm `overrides` 壓平巢狀 `pi-ai`                                                                             | 無，一天內 |
| B     | 引擎換 `Agent`，session tree / compaction / navigation / fork 收回 `agent-runtime`。**在 `pi-agent-core` 0.83.0 上完成**，讓既有測試在同一組版本下作為行為基線 | A          |
| C     | `pi-agent-core` 升 0.84.3：移除 override，改幾個型別 import                                                                                                    | B          |

B 在 0.83 上做是刻意的：0.83 與 0.84.3 的 `Agent` API 一致（0.84 只加了 `shouldStopAfterTurn`、`BeforeToolCallResult.terminate`、`Agent.reset()` 修正），先在不動版本的前提下換引擎，測試失敗時才知道是自己的 plumbing 錯而不是版本差異。

## 3. Phase A：`pi-ai` 0.84.3

### 3.1 變更

1. `pnpm-workspace.yaml`
   - catalog `agent`：`"@earendil-works/pi-ai": 0.84.3`。
   - 新增 `overrides: { "@earendil-works/pi-ai": "0.84.3" }`。`pi-agent-core@0.83.0` 宣告 `pi-ai: ^0.83.0`，0.84.3 不滿足 caret，不 override 會裝兩份 `pi-ai`（`Model<Api>` 型別衝突、provider 重複註冊）。已 grep 0.83 的 `packages/agent/src`：沒有引用任何 0.84 改名或改語意的 `pi-ai` 符號。
   - `minimumReleaseAgeExclude` 加 `@earendil-works/pi-ai@0.84.3`（今日發布）；刪掉已無作用的 `@earendil-works/pi-agent-core@0.82.1`、`@earendil-works/pi-ai@0.82.1`。
2. `pnpm install`；確認 `node_modules/.pnpm` 只剩一份 `pi-ai`（目前殘留 0.84.2 的 `pi-ai` / `pi-agent-core` / `pi-telemetry` 樹）。

### 3.2 行為變化需知

- Anthropic server-side refusal fallback：`usage.cost` 可能按實際回覆的 fallback 模型計價；`getSessionStats` 的累加不受影響，但 `pi-title.test.ts` 之類寫死 `usage` 的 fixture 不動。
- 所有 adapter 預設送 Pi 的 `User-Agent`。
- strict tool schema 自動轉 closed object、optional 欄位收到 `null` 視為省略。專案 tool 用 `StringEnum` + 手寫 typebox，理論上無影響。
- 內建 catalogue 增加（Baseten、Qwen Token Plan、ZAI 中國區等）。`models.test.ts` 用 `toBeGreaterThan(100)`，不會壞。

### 3.3 驗證

`pnpm turbo run type:check test --filter @chia/agent-runtime... --filter @chia/agent-writing... --filter @chia/agent-content...`，再跑 `@chia/service` 的 type:check 與 Nitro build。

## 4. Phase B：`Agent` 引擎 + 自有 session tree

### 4.1 目標形狀

```text
runAgentTurnStep（workflow step，不變）
  └─ runWritingTurn（agent-writing，簽名不變）
      └─ runPiTurn（agent-runtime/pi/turn.ts）
            ├─ session.getBranch()                       ← PgSessionStorage
            ├─ buildSessionContext(branch).messages      ← pi-agent-core 純函式
            ├─ new Agent({ initialState, streamFn, transformContext, beforeToolCall, afterToolCall })
            ├─ agent.subscribe → pi/events.ts → AgentWireEvent（字彙不變）
            ├─ message_end → session.appendEntry({ type: "message", message })
            ├─ approval 批次持久化（不變）
            └─ compactSessionIfNeeded(session, …)        ← pi/compaction.ts 自己驅動
```

`Session` class、`toSession`、`SessionRepo`、`getEntriesToFork`、`createTimestamp` 不再從 Pi 引用。`PgSessionStorage` 就是 session tree 本身。

### 4.2 `session/entries.ts`（新）— 持久化 entry union 歸專案所有

```ts
// packages/agent-runtime/src/session/entries.ts
export interface EntryBase {
  id: string;
  parentId: string | null;
  /** Unix ms. Stored as timestamptz; projected back as a number so the shape matches Pi's Entry. */
  timestamp: number;
}
export interface MessageEntry extends EntryBase {
  type: "message";
  message: AgentMessage;
}
export interface CompactionEntry extends EntryBase {
  type: "compaction";
  summary: string;
  tokensBefore: number;
  retainedTail: AgentMessage[];
  details?: unknown;
  usage?: Usage;
}
export interface BranchSummaryEntry extends EntryBase {
  type: "branch_summary";
  fromId: string;
  summary: string;
  details?: unknown;
  usage?: Usage;
}
export interface ModelChangeEntry extends EntryBase {
  type: "model_change";
  provider: string;
  modelId: string;
}
export interface ThinkingLevelEntry extends EntryBase {
  type: "thinking_level_change";
  thinkingLevel: string;
}
export interface ActiveToolsEntry extends EntryBase {
  type: "active_tools_change";
  activeToolNames: string[];
}
export interface CustomEntry extends EntryBase {
  type: "custom";
  customType: string;
  data?: unknown;
}
/** Not a Pi entry any more in 0.84; kept as a tree entry because that is where `agent.session_entry` already holds it. */
export interface LabelEntry extends EntryBase {
  type: "label";
  targetId: string;
  label: string;
}
export type SessionEntry =
  | MessageEntry
  | CompactionEntry
  | BranchSummaryEntry
  | ModelChangeEntry
  | ThinkingLevelEntry
  | ActiveToolsEntry
  | CustomEntry
  | LabelEntry;
```

- discriminant 字面值與 0.83、0.84.3 完全相同，DB 現有 rows 直接可讀。
- `timestamp` 從 ISO string 改成 ms number：`toEntry()` 一行；`wire/replay.ts` 若讀 entry 的 `timestamp`（而非 `message.timestamp`）要同步改。
- 0.84.3 的 `buildSessionContext` 吃 `Entry[]`；`SessionEntry` 除 `LabelEntry` 外與 `Entry` 結構相容，投影前用 `isContextEntry()` 濾掉 `label` 與 legacy `session_info` rows。Phase C 之前（0.83）`buildSessionContext` 吃 `SessionTreeEntry[]`，同樣以濾後的陣列傳入，用一個局部的 cast 收在 `session/context.ts` 一處。
- `retainedTail` 在 0.84.3 是必填：`compaction` 落盤時一律寫陣列（可空）。

### 4.3 `session/tree.ts`（新）— session tree port 與記憶體實作

```ts
export interface SessionTree {
  getLeafId(): Promise<string | null>;
  setLeafId(leafId: string | null): Promise<void>;
  appendEntry(entry: SessionEntry): Promise<void>; // advances the leaf
  getEntry(id: string): Promise<SessionEntry | undefined>;
  getEntries(options?: {
    afterSeq?: number;
    limit?: number;
  }): Promise<SessionEntry[]>;
  findEntries<T extends SessionEntry["type"]>(
    type: T
  ): Promise<Extract<SessionEntry, { type: T }>[]>;
  /** Root-first path from the leaf, stopping at the newest compaction. */
  getBranch(): Promise<SessionEntry[]>;
  /** Root-first path from `entryId` all the way to the root; forks copy this. */
  getPathToRoot(entryId: string): Promise<SessionEntry[]>;
  getLabel(id: string): Promise<string | undefined>;
  getSessionName(): Promise<string | undefined>;
  getSessionStats(): Promise<SessionStats>;
  newEntryId(): string; // uuidv7
}
```

- `PgSessionStorage` 改為 `implements SessionTree`；刪 `getMetadata`、`createEntryId`（改 `newEntryId`）、`toPgSession`。既有 `getPathToRootOrCompaction` 改名 `getBranch`（內部先 `getLeafId`），legacy root-prefix 修補邏輯照搬。
- `InMemorySessionTree`：Map + parentId walk，替代 `agent-writing/__tests__/runtime.test.ts` 用的 `InMemorySessionRepo`。這是唯一新增的介面，理由是測試需要第二個實作；沒有 registry、沒有 factory。
- `SessionStats` 型別自 Pi 移入 `session/entries.ts`（五個數字欄位）。
- 刪除 `session/pi.ts`（原本只是 re-export Pi 符號）。`kind.ts`、`runtime.ts`、`service.ts` 的 `Session` 型別改 `SessionTree`。

### 4.4 `session/pg-repo.ts` — 拿掉 `implements SessionRepo`

- `create` / `open` / `openById` / `list` / `delete` 回傳 `PgSessionStorage`；`createdAt` 直接 `new Date().toISOString()`。
- `fork(source, { entryId, position, ...create })`：`getPathToRoot(entryId)`，`position: "before"` 去掉最後一個；依序 `appendEntry` 到新 session（`appendEntry` 會推進 leaf，不再手動 `setLeafId`）。行為對照 0.83 `harness/session/repo-utils.ts` 的 `getEntriesToFork`（`git show v0.83.0:packages/agent/src/harness/session/repo-utils.ts`）。
- `SessionError("not_found")` 改 `AppError`（`@chia/service-kit/errors`），符合 repo 的錯誤慣例；`service.ts` 對應的 catch 一併改。

### 4.5 `pi/turn.ts` — `runPiTurn` 改寫

保留 `RunPiTurnOptions` 簽名（`session` 型別改 `SessionTree`），`agent-writing/runtime.ts` 不動。內部：

1. **投影**：`branch = await session.getBranch()`；`context = buildSessionContext(contextEntries(branch))`。`initialState = { systemPrompt, model, thinkingLevel: clampSessionThinkingLevel(model, settings), tools: boundTools, messages: context.messages }`。`activeToolNames` 在這裡就過濾 tools（0.83 harness 由 `activeToolNames` 選工具，改成 host 過濾後直接給 `Agent`）。
2. **system prompt**：`systemPrompt` 若是函式先 await。skills 段落的組成方式對照 0.83 `harness/system-prompt.ts` 的 `buildSystemPrompt`（`formatSkillsForSystemPrompt` 在 0.84.3 仍匯出），確認 `agent-writing/src/prompts/system.ts` 是否已自行列出 skills；兩邊只能有一邊做，否則前綴變動打掉 prompt cache。
3. **prompt 文字**：`message.template` → `formatPromptTemplateInvocation(template, args)`；skill 呼叫 → `formatSkillInvocation(skill)`；否則 `message.text`。找不到 template 直接 `AgentTurnError{ kind: "internal" }`。
4. **hooks**
   - `beforeToolCall(ctx)`：`turnBudget.handle(ev) ?? gate.handle(ev)`，`ev = { toolName: ctx.toolCall.name, toolCallId: ctx.toolCall.id, input: ctx.args }`；回 `{ block: true, reason }`。`hardMaxToolCalls` 用 `terminate: true`（0.84.1 起；0.83 時仍走 `failTurn` abort）。
   - `transformContext(messages)`：有 `volatileContext` 時回 `[...messages, volatileMessage(text)]`；失敗 fail closed，同現行。
   - `afterToolCall(ctx)`：`policy.changesState` 的 `state:changed` 事件，回 `undefined`。
   - 每個 hook 自己 `try/catch` → `failTurn()`，「host failure 一律 `internal`」不變。
5. **streamFn**：`(model, ctx, opts) => models.streamSimple(model, ctx, opts)`，綁在每 turn 建的那份帶 BYOK 憑證的 `Models` 上。**不用** `setDefaultStreamFn`，它是 process-wide 的，會讓 BYOK 落到 ambient key。
6. **事件**：`agent.subscribe((event) => { for (const w of mapEvent(event)) onEvent(w) })`；`mapEvent` 的輸入型別改 `AgentEvent`。`session_compact` 這個 Pi 事件消失，`session:compacted` 由 §4.7 的 compaction 函式自己 emit。
7. **持久化**：同一個 subscriber 裡，`message_end` → `session.appendEntry({ type: "message", id: session.newEntryId(), parentId: <current leaf>, timestamp: event.message.timestamp, message })`。`agent-loop` 對 user prompt 也 emit `message_end`（`agent-loop.ts:113`），所以 user 訊息一併落盤，順序與 0.83 harness 相同。parentId 用 turn 開始時讀到的 leaf，之後每次 append 後更新本地 cursor，不回 DB 重讀。
8. **完成判定**：`await agent.prompt(text)` 回 `void`；最終 assistant message 從最後一次 `message_end` 的 assistant 取得。`stopReason` 的三段判斷（`aborted` / `error` / 其他）不變。
9. **abort**：`signal` listener 直接 `agent.abort()`。0.83 那個「`before_provider_request` 再檢查一次」的補洞改成 prompt 前 `if (signal.aborted) return aborted` + listener，並用測試驗證「run 尚未 arm 時 abort」的視窗。
10. deadline、approval 批次持久化、compaction 只在成功且無 pending approval 時觸發、`run:end`、unsubscribe、`flushEvents` 全部照舊。

### 4.6 `tools.ts` — 綁 context

`Agent` 的 `AgentTool.execute` 是四參數；專案的 `AgentHarnessTool` 是五參數（最後一個 `context`）。在 `tools.ts` 加：

```ts
export const bindToolContext = <TContext extends object>(
  tools: AgentTool<TContext>[],
  context: TContext | (() => TContext | Promise<TContext>)
): PiAgentTool[] => …  // execute: (id, params, signal, onUpdate) => tool.execute(id, params, signal, onUpdate, await resolve(context))
```

`types.ts` 的 `AgentTool<TContext>` 改為專案自己的型別（`Omit<PiAgentTool, "execute"> & { execute(…, context) }`），不再 alias `AgentHarnessTool`：上游規格 slice 1 會把 `harness/**` 整個刪掉，`AgentHarnessTool` 屬於那個目錄。`toolDefiner` 簽名不變，各 kind 的 `*.tool.ts` 不動。

### 4.7 `pi/compaction.ts` 與 `pi/maintenance.ts` — 自己驅動

```ts
export const compactSession = async (opts: { session; models; model; thinkingLevel; customInstructions?; signal? }) => {
  const branch = await session.getBranch();
  const prep = prepareCompaction(contextEntries(branch), DEFAULT_COMPACTION_SETTINGS);   // Result
  if (!prep.ok || !prep.value) return null;
  const result = await compact(prep.value, models, model, customInstructions, signal, thinkingLevel);
  await session.appendEntry({ type: "compaction", …result, retainedTail: result.retainedTail ?? [] });
  return { summary, tokensBefore };
};
export const compactSessionIfNeeded = (…) => shouldCompactBranch(branch, contextWindow) ? compactSession(…) : null;
```

- `prepareCompaction(pathEntries, settings)`、`compact(preparation, models, model, …)`、`generateBranchSummary`、`collectEntriesForBranchSummary`、`prepareBranchEntries` 在 0.83 與 0.84.3 都是匯出的純函式，簽名見 `packages/agent/src/harness/compaction/*.ts`。compaction entry 的 `parentId` 是當前 leaf，append 後 leaf 指向 compaction entry——與 0.83 harness `compact()` 一致（對照 `agent-harness.ts` v0.83.0 L735–780）。
- `navigateSession(session, entryId, { summarize, label })`：`setLeafId(entryId)`；`label` → append `LabelEntry`；`summarize` → 用 branch-summarization 三個函式產生 `BranchSummaryEntry`（`fromId` = 原 leaf）append 在新 leaf 之後。回 `{ cancelled }` 的語意對照 0.83 `navigateTree`。
- `pi/maintenance.ts` 的 `compactPiSession` / `navigatePiSession` 改呼叫上面兩個函式；不再建任何 harness。`compactPiHarnessIfNeeded` 改名 `compactSessionIfNeeded`。

### 4.8 `pi/events.ts`、`wire/replay.ts`、`session/usage.ts`

- `events.ts`：輸入型別 `AgentHarnessEvent` → `AgentEvent`（`pi-agent-core` 匯出）。case 集合不變；新增 `tool_execution_update` → `tool:update`（wire schema 已有這個字彙但目前沒人 emit）。
- `replay.ts`、`usage.ts`：`SessionTreeEntry` → `SessionEntry`；`usage.ts` 的 `buildSessionContext` 呼叫改吃 `contextEntries(entries)`。
- `estimateBranchContextTokens` 邏輯不動。

### 4.9 `apps/service`

- `agents/kind.ts`：`Session` 型別 → `SessionTree`。
- `agents/service.ts`：`session.getBranch()` 不變；`session.getStorage().getEntries()` → `session.getEntries()`；`SessionTreeEntry` → `SessionEntry`；`SessionError` catch → `AppError`。
- `steps/agent-turn.step.ts`：`repo.openById()` 回傳型別改變，其餘不動。

### 4.10 `package.json` exports

- 刪 `./session/pi`。
- 新增 `./session/entries`、`./session/tree`、`./session/context`（`contextEntries` / `buildSessionContext` 的包裝，server-only）。
- `./pi/*`、`./session/*`、`./models` 仍 server-only；`./wire/schema`、`./wire/fold` 仍無 Pi 依賴。

### 4.11 測試

既有測試作為基線，先跑一次全綠再動手：

| 測試                                                           | 變更                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent-runtime/__tests__/runtime.test.ts`                      | 刪掉 `vi.mock` 的 `AgentHarness` stub，改用真的 `Agent` + `fauxProvider` + `InMemorySessionTree`。原 17 個 case 的斷言（hook 組合順序、abort 只呼叫一次、compact 只在成功且無 approval 時、unsubscribe 全部呼叫）改成從 wire event 與 session tree 內容觀察 |
| `agent-writing/__tests__/runtime.test.ts`                      | `InMemorySessionRepo` → `InMemorySessionTree`；13 個 case 斷言不動——它們正是要守住的行為（tier-3 refusal handshake、mid-generation abort、volatile context 不落盤、provider failure 分類）                                                                  |
| `pg-storage.test.ts`                                           | `timestamp` 改 number；`getPathToRootOrCompaction` → `getBranch`；新增 `getPathToRoot`                                                                                                                                                                      |
| `pi-compaction.test.ts`、`events.test.ts`、`pi-errors.test.ts` | 型別 import 改名                                                                                                                                                                                                                                            |
| **新增** `session/context.test.ts`                             | **投影確定性**：同一組 entries 投影兩次、以及「上一 turn 送出的 context + 新 append 的 entries」與「下一 turn 從 tree 重新投影」必須 `JSON.stringify` 逐 byte 相等。這是 prompt cache 命中率的守門員                                                        |
| **新增** `pi/turn.test.ts` 補 case                             | hook 丟錯 → turn 以 `internal` 結束且 assistant 不會是 `error`；abort 在 run arm 前觸發 → `aborted` 且無 provider 呼叫；`message_end` 落盤順序（user → assistant → toolResult）與 leaf 推進                                                                 |
| **新增** `pi/maintenance.test.ts`                              | compaction entry 落盤形狀（`retainedTail` 必為陣列）與 leaf；navigate 的 label / branch_summary                                                                                                                                                             |
| `pg-repo.test.ts`（新）                                        | fork 的 `before` / `at` 語意                                                                                                                                                                                                                                |

### 4.12 文件

- `docs/agent-architecture.md` 與 `.zh.md`：§1（Pi-first 段落改為「`Agent` 是引擎、session tree 由 runtime 擁有；不做 harness adapter 的立場不變」）、§3「Session tree and tables」、§4「Concrete execution path」與「Host failures inside Pi hooks」、§8「Compaction and navigation」、§12 reference。
- `packages/AGENTS.md` 的 `agent-runtime` 段落。
- `plans/pi-first-agent-architecture-plan.md` 加一行指向本計劃。

## 5. Phase C：`pi-agent-core` 0.84.3

Phase B 完成後剩下的差異：

1. catalog `agent` 的 `pi-agent-core` 改 0.84.3；移除 §3.1 的 `overrides`；`minimumReleaseAgeExclude` 對應更新。`@earendil-works/pi-telemetry` 是 transitive，不必加進 catalog。
2. `session/context.ts` 的 `buildSessionContext` 呼叫從 `SessionTreeEntry[]` cast 改為直接傳 `Entry[]`（`SessionEntry` 已與 `Entry` 相容），刪掉那個 cast。
3. `AgentTool`、`AgentEvent`、`AgentToolResult`、`ThinkingLevel`、`Skill`、`PromptTemplate`、`formatSkillInvocation`、`formatPromptTemplateInvocation`、`uuidv7`、compaction 函式在 0.84.3 全部仍匯出，import 路徑不變。
4. `beforeToolCall` 的 `hardMaxToolCalls` 改用 `terminate: true`。
5. 跑 §4.11 全套。

## 6. 風險與驗證清單

| 風險                                                                                                                       | 處理                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 投影不確定性打掉 prompt cache                                                                                              | §4.11 的 byte-equality 測試；`toEntry` 不得依賴 DB 回傳的欄位順序（payload spread 後再放 base 欄位，順序固定）                                                                                        |
| system prompt 前綴變動                                                                                                     | §4.5 第 2 點：skills 段落只能組一次；上線後用 `usage.cacheRead` 比對遷移前後同一 session 的命中率                                                                                                     |
| `Agent` 對 hook 丟錯的處理與 0.83 harness 不同                                                                             | 每個 hook 自己 catch，不依賴引擎；測試覆蓋                                                                                                                                                            |
| abort 在 run arm 前的視窗                                                                                                  | prompt 前檢查 + listener；測試覆蓋                                                                                                                                                                    |
| 同一 session 兩個 writer                                                                                                   | `agent.run` 的「one active run per session」partial unique index 是唯一防線，遷移前後都不能動；`runPiTurn` 內 leaf cursor 只在本 turn 有效                                                            |
| 上游 slice 1 會刪 `harness/**`，`buildSessionContext`、compaction 函式、`formatSkillInvocation`、`substituteArgs` 都在裡面 | 本計劃已把它們的呼叫集中在 `session/context.ts`、`pi/compaction.ts`、`pi/turn.ts` 三處；到時候若消失，vendoring 這幾個純函式（compaction 約 700 行、context 約 100 行）是明確且有界的工作，不是現在做 |
| 0.83 `Agent` 沒有 `terminate`                                                                                              | Phase B 期間 `hardMaxToolCalls` 仍走 `failTurn` abort，Phase C 再切                                                                                                                                   |

## 7. 不做的事

- 不保留 `AgentHarness` 路徑作為 fallback，不留 feature flag 切換引擎。
- 不為 `SessionTree` 加第三個實作（SQLite、JSONL）。
- 不把 `label` 改成獨立表或欄位；它留在 `session_entry` 是因為 0.83 的資料已經在那裡，而且 navigate 的 label 本來就是 tree 上的事件。
- 不動 wire contract（`AgentWireEvent`）與 `agent-elements`。

## 8. 參考

- 上游 repo：`https://github.com/earendil-works/pi`，tags `v0.83.0`、`v0.84.3`
  - `packages/agent/src/harness/agent-harness.ts`（0.83 完整實作；0.84.3 scaffold）
  - `packages/agent/src/agent.ts`、`agent-loop.ts`（`Agent` 引擎）
  - `packages/agent/src/harness/compaction/compaction.ts`、`branch-summarization.ts`
  - `packages/agent/src/harness/session/context.ts`（`buildSessionContext`）
  - `packages/agent/docs/harness.md`（v4 規格；Part 8 build order）
  - `packages/agent/CHANGELOG.md`、`packages/ai/CHANGELOG.md`（0.84.0–0.84.3）
- 本 repo：`docs/agent-architecture.md`、`plans/pi-first-agent-architecture-plan.md`
