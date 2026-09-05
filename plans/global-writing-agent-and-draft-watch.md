# 全域 writing agent、draft 即時串流與 dash drawer

> 狀態：待實作
>
> 建立：2026-09-05
>
> 基底：`feat/feed-draft`（commit `7f85b08f9` 之後），PR 尚未開。本計劃在同一分支或其上再開分支實作，最後一起 PR 進 `develop`。
>
> 相關：[docs/agent-architecture.md](../docs/agent-architecture.md) 第 3、7、9 節；`packages/AGENTS.md` feed_draft 條目。

## 0. 已確認的決策

| 項目                  | 決定                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Agent 與 draft 的關係 | 全域。session 不綁 draft，改記錄「碰過哪些 draft、各自看到哪個 revision」                         |
| 交付 draft 給 agent   | prompt 附件 `{ type: "draft", id }`，非 session 建立參數                                          |
| 即時串流 transport    | oRPC event iterator（SSE 語意），不上 WebSocket。契約與 bus 設計成之後可換 `@orpc/server/crossws` |
| 變更事件來源          | Postgres `pg_notify` 在 draft 寫入交易內發出；service 一個帶重連的 LISTEN client                  |
| service replica       | 目前單一 replica；in-process bus 即可，但 NOTIFY 設計本身多 replica 安全                          |
| 串流粒度              | 每次工具呼叫（draft row 變動）一次，不做逐字                                                      |
| Dash 呈現             | 與 www 相同：上排 header 放按鈕，agent 以右側 drawer 呈現；composer 顯示目前 draft                |
| Agent 工具            | 新增 `list_drafts`、`open_draft`；不給 `discard`                                                  |
| `sessions.create`     | 移除 `targetFeedId` 與 `draftId`                                                                  |

本計劃選定但未經確認的預設（實作時若不同意再改）：

- `/agent` 頁面移除，drawer 取代；`/agents`（kind 與 task 管理）保留。
- Session summary 不再帶 `draftId`／`targetFeedId`；detail 改帶 `drafts[]`（碰過的 draft，最近優先）。
- 每則 prompt 最多 4 個附件；目前只有 `draft` 一種型別。
- Volatile context 最多列 5 份最近碰過的 draft，避免 token 膨脹。
- Editor 的 polling 保留為 60 秒保底心跳，串流為主。

## 1. 分階段

三個階段各自可獨立驗證，建議依序做、各自一個 commit。

### Phase 1 — 全域 writing agent

#### 1.1 資料層 `packages/db`

- `src/schemas/agent.schema.ts`
  - `writingAgentSessions` 只留 `sessionId`（未來 kind state 仍放這）。移除 `draftId`、`lastSeenRevision` 與 index。
  - 新增 `writingAgentSessionDrafts` = `agent.writing_session_draft`：
    - `sessionId` → `agent.session.id` on delete cascade
    - `draftId` → `feed_draft.id` on delete cascade（draft 被 discard，列自動消失）
    - `lastSeenRevision` int not null default 0
    - `touchedAt` timestamptz not null
    - PK `(sessionId, draftId)`，index on `draftId`
- `src/schemas/relations.ts`：加對應 relations。
- `src/libs/agent/index.ts`
  - `createWritingAgentSession(db, { sessionId })`
  - `getWritingAgentSession(db, sessionId)` → `{ sessionId, drafts: { draftId, lastSeenRevision, touchedAt }[] }`，依 `touchedAt` desc。
  - `touchWritingSessionDrafts(db, sessionId, entries: { draftId; lastSeenRevision?: number }[])`：upsert，`touchedAt = now()`，`lastSeenRevision` 只升不降。
  - `copyWritingSessionDrafts(db, from, to)` 給 fork。
  - 刪除 `updateWritingAgentSession`。
- Migration `.drizzle/migrations/<ts>_writing_session_draft`（`drizzle-kit generate --hints` 標 create）：
  1. 建表。
  2. `insert into agent.writing_session_draft select session_id, draft_id, last_seen_revision, now() from agent.writing_session where draft_id is not null`。
  3. 刪 `writing_session.draft_id`、`last_seen_revision` 與 index。
  4. 本機 `ENV=local drizzle-kit migrate` 驗證。

#### 1.2 Runtime `packages/agent-runtime`

- `src/types.ts`：`AgentTurnMessage.attachments?: AgentAttachment[]`，`AgentAttachment = { type: string; id: string; label?: string }`。
- `src/wire/schema.ts`：`user` 事件加 `attachments` 同型別（optional，舊串流仍可 parse）。`fold.ts` 帶入 view。
- `src/pi/turn.ts`：新選項 `renderAttachments?: (attachments) => Promise<string>`。有附件時 prompt 文字 = 渲染結果 + 空行 + 原文；`user` 事件帶 `attachments` 與原文。持久化的 user entry 存原文與附件，不存渲染結果（渲染是 volatile 的責任之一，避免舊標題進 transcript）。
  - 注意：渲染結果送給模型但不進 durable entry，所以 replay 時模型 context 由 `projectMessages` 重建，需要在投影時再渲染一次。若這太重，改成把渲染文字直接存進 entry；二選一，實作時看 `session/` 的投影點決定。
- Tests：`events.test.ts`、`fold.test.ts`、`runtime.test.ts` 加附件案例。

#### 1.3 Domain `packages/agent-writing`

- `src/types.ts`
  - 新增 `FeedDraftSummary { id; feedId; slug; title; revision; updatedAt }`。
  - `FeedDraft` 不變。
- `src/ports.ts` `DraftStore` 改為多 draft：

  ```ts
  interface DraftStore {
    list(): Promise<FeedDraftSummary[]>;
    open(input: { feedId?: number }): Promise<FeedDraft>;
    get(draftId: number): Promise<FeedDraft>;
    patchFeedMeta(draftId: number, patch: DraftFeedMeta): Promise<FeedDraft>;
    patchTranslation(
      draftId: number,
      locale: Locale,
      patch: DraftTranslation
    ): Promise<FeedDraft>;
    setContent(
      draftId: number,
      locale: Locale,
      content: string,
      expectedRevision?: number
    ): Promise<FeedDraft>;
    operatorChangesSince(
      draftId: number,
      afterRevision: number
    ): Promise<DraftChange[]>;
    /** 本 turn 每份 draft 最後看到的 revision；host 在 turn 結束寫回。 */
    readonly observedRevisions: ReadonlyMap<number, number>;
  }
  ```

- `src/draft/pg-draft-store.ts`：`PgDraftStore(db, { sessionId, list, open })`，`list`／`open` 由 host 注入（domain 套件不得 import `@chia/api`）。每次回傳 draft 時更新 `observedRevisions`。
- `src/draft/memory-draft-store.ts`：同介面，`operatorEdit(draftId, …)`、`seed(drafts)`。
- `src/tools/registry.ts`：新增 `listDrafts: "list_drafts"`（tier read）、`openDraft: "open_draft"`（tier draft）；labels。
- `src/tools/draft.tool.ts`
  - `list_drafts`：回 id、feedId、slug、title、revision、updatedAt。
  - `open_draft({ feedId? })`：取得或建立，回 `FeedDraft` 摘要（不含 body）。
  - `read_draft`、`patch_draft_meta`、`write_draft_content`、`edit_draft_content` 加必填 `draftId`；`write` 釘在 `observedRevisions.get(draftId)`，`edit` 衝突重試一次的邏輯保留。
- `src/tools/commit.tool.ts`：`commit_draft({ draftId })`；`set_published` 不變。
- `src/prompts/system.ts`
  - `TurnContextInput` 改為 `drafts: { summary: FeedDraftSummary; feedId; locales; operatorChanges }[]`、`openDraftCount`、其餘不變。
  - 沒碰過 draft 時提示：「先 `list_drafts`，或 `open_draft` 開新的；operator 交付的 draft 會以附件出現在訊息裡」。
  - 工作流程段落改成 draftId 導向。
- `src/runtime.ts`
  - 選項 `lastSeenRevisions: ReadonlyMap<number, number>`、`touchedDraftIds: number[]`。
  - `volatileContext`：對 `touchedDraftIds` 前 5 份呼叫 `draft.get` 與 `operatorChangesSince`，組 `drafts`；`draft.list()` 取 `openDraftCount`。
  - `renderAttachments`：`draft` 型別 → 用 `draft.get(id)` 產生「Attached draft #12 — {title or slug}, revision N, feed #X / new post」，並把 id 併入本 turn 的 touched 清單。
- Tests：`pg-draft-store.test.ts`、`tools.test.ts`、`runtime.test.ts`、`turn-context.test.ts`、`system-prompt.test.ts`、`fixtures.ts` 全面改成 draftId 導向；新增 `list_drafts`／`open_draft`／附件渲染案例。

#### 1.4 Host `packages/agent-host`

- `src/kind.ts`
  - `AgentCreateSessionInput` 移除 `targetFeedId`、`draftId`。
  - `summary()` 回 `{}`（型別保留擴充位）。
  - `detail()` 回 `{ drafts?: AgentDraftPayload[] }`，移除 `draft`。
  - 新增 `attach?(db, caller, sessionId, attachments): Promise<void>`：驗證附件歸屬與存在，並 `touchWritingSessionDrafts`。由 service 在 enqueue 前呼叫，讓錯誤在 API 邊界就回 `BAD_REQUEST`／`NOT_FOUND`。
- `src/writing.ts`
  - `CreateWritingAgentKindOptions`：`openDraft({ db, adminId, sessionId, feedId? })`、`listDrafts({ db, adminId })`。
  - `state.create`：只建 `writing_session` 列。
  - `state.fork`：`copyWritingSessionDrafts`。
  - `state.detail`：載入碰過的 drafts → `toDraftPayload`。
  - `attach`：`getFeedDraft` 檢查 `userId`，`touchWritingSessionDrafts`。
  - `runTurn`：建 `PgDraftStore`；`touchedDraftIds` 來自 state；turn 結束把 `observedRevisions` 透過 `touchWritingSessionDrafts` 寫回（只升不降）。
- Tests：`packages/agent-host/__tests__` 目前沒有 writing 專測，新增 `writing.test.ts` 覆蓋 create／fork／detail／attach／runTurn 寫回。

#### 1.5 Workflow 與控制通道

- `packages/workflow-control/src/agent.hooks.ts`：`agentMessagePayloadSchema.attachments` optional。
- `apps/workflow/src/workflows/agent-session.workflow.ts`、`src/steps/agent-turn.step.ts`：`AgentTurnRequest.attachments` 透傳到 `runTurn` 的 `message`。
- `apps/workflow/src/agents/writing.ts`：提供 `openDraft`（沿用 `openFeedDraftService`，author Agent）與 `listDrafts`（`listOpenFeedDrafts`）。
- Tests：`agent-session.workflow.test.ts` 加附件透傳。

#### 1.6 API `packages/api`

- `orpc/contracts/agent.contract.ts`
  - `agentAttachmentSchema = z.object({ type: z.literal("draft"), id: z.number().int() })`；prompt action 加 `attachments: z.array(agentAttachmentSchema).max(4).optional()`。
  - `createAgentSessionContract` 移除 `targetFeedId`、`draftId`。
  - summary 移除 `draftId`、`targetFeedId`；detail `draft` → `drafts: z.array(feedDraftSchema)`。
  - `agentWireEventSchema` 由 runtime 匯出，`user.attachments` 自動跟上。
- `orpc/services/agent/turn.ts`：`prompt` 收 `attachments`，鎖內先 `definition.attach?.(…)` 再 enqueue；hook payload 帶 `attachments`。
- `orpc/services/agent/session.ts`：`create` 不再傳 feed／draft。
- `orpc/routes/agent.route.ts`：prompt 分支透傳。
- Tests：`agent-run-control.test.ts` 或新增 `agent-turn.test.ts` 覆蓋 attach 失敗回 `NOT_FOUND`。

#### 1.7 Service 與 MCP `apps/service`

- `src/agents/writing.ts`：`openDraft`、`listDrafts`。
- `src/mcp/server.ts`
  - `write_post`：`sessions.create({ kind })` 後 `sessions.chat({ action: { type: "prompt", text, attachments: draftId ? [{ type: "draft", id }] : [] } })`；`targetFeedId` 改為先 `draft:open({ feedId })` 再附件。回傳 `draftId` 維持。
  - `writing_status`：改讀 `detail.drafts`。
- Tests：`mcp.server.test.ts` 對應調整。

#### 1.8 Dash（Phase 1 最小改動）

- `src/components/agent/draft-attachments.tsx` → 改名 `session-drafts.tsx`，輸入 `drafts: AgentDraft[]`，每份一個 chip，點開 drawer 看 metadata／內容，保留 Open in editor。
- `src/components/agent/writing-session.tsx`：`useSessionDetail().data?.drafts`。
- `src/components/feed/draft-actions.tsx` Open in agent：暫時改為 `router.push("/agent?draft=" + id)`，Phase 3 再換成開 drawer。
- `agent-workspace.tsx`：讀 `?draft=` 時，第一則 prompt 自動帶附件（Phase 3 會被 composer 附件 UI 取代，這裡可先略過只做 push）。

#### 1.9 文件

- `docs/agent-architecture.md` 與 `.zh.md`：第 3 節 state 表（`writing_session_draft`）、第 7 節 fork 說明、第 9 節 Shared draft 改寫為多 draft 與附件、`lastSeenRevision` 改為 per draft。
- `packages/AGENTS.md`：feed_draft 條目補「session 對 draft 是多對多，經 `writing_session_draft`」。
- `apps/AGENTS.md`：MCP 一行改述。

### Phase 2 — 變更匯流排與 `feeds.draft:watch`

#### 2.1 通知來源 `packages/db`

- `src/libs/drafts/notice.ts`（新）：

  ```ts
  export const FEED_DRAFT_CHANNEL = "feed_draft";
  export const feedDraftNoticeSchema = z.discriminatedUnion("type", [
    z.object({
      type: z.literal("revision"),
      draftId,
      revision,
      author,
      sessionId: z.string().nullable(),
      changes: feedDraftChangeSchema.array(),
    }),
    z.object({ type: z.literal("applied"), draftId, revision, feedId }),
    z.object({ type: z.literal("discarded"), draftId }),
  ]);
  export const notifyFeedDraft = (tx, notice) =>
    tx.execute(
      sql`select pg_notify(${FEED_DRAFT_CHANNEL}, ${JSON.stringify(notice)})`
    );
  ```

  Payload 只帶欄位清單不帶內容（NOTIFY 上限 8 KB）。

- `src/libs/drafts/index.ts`：`patchFeedDraft`／`replaceFeedDraft` 在交易內、`recordRevision` 之後呼叫 `notifyFeedDraft`（每次 revision bump 都發，與 operator 合併紀錄無關）；`markFeedDraftApplied` 發 `applied`；`deleteFeedDraft` 發 `discarded`。`restoreFeedDraftRevisionService` 走 `replaceFeedDraft` 自然涵蓋。
- `src/libs/drafts/listen.ts`（新）：`listenFeedDraft(url, onNotice, { signal })`
  - 專用 `pg.Client`，`keepAlive: true`，掛 `error` 與 `end` handler。
  - 斷線後指數退避重連（1 s 起，上限 30 s），重連成功後重新 `LISTEN`。
  - payload 用 `feedDraftNoticeSchema.safeParse`，壞資料只記 log。
  - 這是 world-postgres LISTEN client 死掉事件的直接教訓，不可省略。
- `package.json` exports 加 `./repos/drafts/notice`、`./repos/drafts/listen`。
- Tests：`packages/db/__tests__/drafts-notice.spec.ts` 驗證 schema 與 payload 大小。

#### 2.2 Service 端 bus

- `packages/api/feeds/draft-bus.ts`（新）：`FeedDraftBus` 以 draftId 為 key 的 listener set；`subscribe(draftId, fn) → unsubscribe`、`publish(notice)`。純記憶體，無 IO。
- `apps/service/plugins/feed-draft-bus.ts`（新 Nitro plugin）：建 bus、以 `DATABASE_URL` 啟 `listenFeedDraft`，把 bus 掛到 `globalThis` 或 module singleton。
- `apps/service/src/factories/orpc.factory.ts`：oRPC context 加 `draftBus`。
- `packages/api/orpc/routes/context` 型別對應加 `draftBus`。

#### 2.3 契約與路由

- `packages/api/orpc/contracts/feeds.contract.ts`：

  ```ts
  export const watchFeedDraftContract = oc
    .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, NOT_FOUND: {} })
    .input(
      z.object({
        draftId: z.number().int(),
        afterRevision: z.number().int().min(0),
      })
    )
    .output(asyncIteratorObject(feedDraftNoticeSchema));
  ```

  Router key `draft:watch`，`router.contract.ts` 與 `router.ts` 同步。

- `packages/api/orpc/routes/feeds.route.ts` handler（`rootWriteGuard`）：
  1. `getFeedDraft` 驗證歸屬，否則 `NOT_FOUND`。
  2. 起點 = `max(afterRevision, lastEventId)`；`lastEventId` 由 oRPC 在重連時帶入 `opts.lastEventId`。
  3. 先訂閱 bus（避免 replay 與 live 之間漏事件），再從 `feed_draft_revision` 補送 `revision > 起點` 的紀錄，接著 yield bus 事件；用 `withEventMeta(notice, { id: String(revision) })` 標記。
  4. `signal` 中止時取消訂閱。
  5. 30 秒沒事件 yield 一則 `{ type: "ping" }`（加進 schema）以維持 proxy 連線；或確認 oRPC event iterator 內建 keepalive 後省略。
- `apps/service/src/routes/rpc.route.ts`：`UNTIMED_PROCEDURE_PATHS` 加 `/feeds/draft:watch`。
- Tests：`packages/api/__tests__/feeds-draft-watch.test.ts`：replay 順序、bus 事件、簽名者不符回 `NOT_FOUND`、`lastEventId` 續傳。

#### 2.4 Dash editor 接線

- `apps/dash/src/libs/orpc/client.ts`：`RPCLink` 加 `RetryLinkPlugin`（`@orpc/client/plugins`），預設關閉，`draft:watch` 呼叫時以 context 開啟 `retry: Infinity`、退避 1 s → 10 s。
- `apps/dash/src/components/feed/draft-editor.tsx`
  - 新 hook `useDraftWatch(draftId, afterRevision, onNotice)`：`useEffect` 內 `for await (const notice of client.feeds["draft:watch"](input, { signal, context: { retry } }))`，unmount 時 abort。
  - `revision`：`revision > savedRef.revision` 才處理，沿用現有 adopt／dirty 規則（自己的儲存回傳的 revision 已寫入 `savedRef`，所以自己的通知會被略過）。
  - `applied`：invalidate `draft:get`、顯示 toast。
  - `discarded`：跳回 `/feed/drafts`。
  - 加一個「Agent editing」presence chip：最近 10 秒內收到 `author === "agent"` 的通知即亮。
  - `POLL_INTERVAL_MS` 改 60 秒作保底。
- `apps/dash/src/components/feed/draft-list.tsx`：不接串流，維持 query。

### Phase 3 — Dash agent drawer

- `apps/dash/src/components/agent/agent-drawer.tsx`（新）
  - HeroUI `Drawer`，`placement="right"`，`max-w-xl`，以 `nuqs` 的 `useQueryState("agent")` 控制開關，與 www `chat-drawer.tsx` 同構。
  - `Drawer.Trigger` 放在 `app/(workspace)/layout.tsx` header 右側；只對 operator 顯示（layout 已有 `getSession`，再用 `getAccess()` 判斷 level 後才 render trigger）。
  - Body 內容為 `AgentWorkspace` 拆出的 `AgentPanel`：session tabs、`WritingSession`（thread + composer）。內容用 `next/dynamic` 延遲載入。
- `apps/dash/src/components/agent/agent-workspace.tsx` → 拆為 `agent-panel.tsx`（可嵌入 drawer）與移除頁面殼層；刪除 `app/(workspace)/(operator)/agent/page.tsx`。
- 目前 draft 的來源：`apps/dash/src/store/draft/` 加 `current-draft` context，由 `containers/feed/edit-feed.tsx` 的 `EditDraft`／`EditFeed` 提供 `{ id, title, feedId }`。
- Composer：
  - `packages/agent-elements/src/store.ts` `prompt(text, options?: { attachments })`；`composer.tsx` 新 prop `pendingAttachments` 與 `onSubmit` 透傳。
  - `writing-session.tsx` 的 `attachments` 區塊顯示兩類 chip：
    1. 目前頁面的 draft（可切換是否附上，預設附上；離開 draft 頁面即消失）。
    2. session 碰過的 drafts（來自 detail，唯讀，可 Open in editor）。
  - 送出時把勾選的 draft 放進 `attachments`。
- `apps/dash/src/components/feed/draft-actions.tsx` Open in agent：改為 `setAgent("open")`，不再建立 session。
- Thread 的 user 訊息渲染附件 chip（`packages/agent-elements/src/thread.tsx` 讀 `attachments`）。
- Tests：`apps/dash/__tests__/agent-drawer.test.tsx`（trigger 只對 operator 顯示、`?agent` 開關）。

## 2. 驗證

每個 phase 結束跑：

```sh
pnpm turbo run type:check lint
pnpm turbo run test --filter @chia/db --filter @chia/agent-runtime --filter @chia/agent-writing --filter @chia/agent-host --filter @chia/api --filter service --filter workflow --filter dash
```

已知：`@chia/ui` 與 `@chia/contents` 的 `test` task 因無測試檔而失敗，是 develop 上的既有狀況；`@chia/api` router-import 與 dash agent-admin-cards 在全並行下偶發，單獨跑會過。

手動驗證（本機 docker `chia-paradedb`，`ENV=local`）：

1. Phase 1：dash 開兩個 draft，同一 session 用附件各改一次，`list_drafts` 看得到兩份；fork 後 detail 的 `drafts` 一致；discard 其中一份後 session detail 少一份，下一 turn 不報錯。
2. Phase 2：兩個分頁開同一 draft，一邊打字另一邊 1 秒內更新；agent turn 寫入時 editor 立即刷新且 presence chip 亮；重啟本機 Postgres 後 service log 顯示重連並持續收到通知。
3. Phase 3：任何頁面按 header 按鈕開 drawer；在 `/feed/draft/:id` 開 drawer 時 composer 顯示該 draft chip，送出後 thread 的 user 訊息顯示附件。

### 2.5 為何不把通知走 workflow World stream

- World stream 是 per run，只能在 step 內用 `getWritable` 寫。editor 與 MCP 的寫入發生在 service，沒有 run 可寫；要走 workflow 每次自動儲存都得多一趟 `workflowControl` → 單一 replica 的 workflow process → step，延遲與耦合都不划算。
- service 讀 World stream 用的是 world-postgres 內建的 LISTEN client，那正是 2026-08-28 資料庫重啟後死掉的那個；`createWorld` 只能注入 `pool`，注不進自己的 listener，所以掛在它上面等於繼承問題而不是解決。
- draft 已有自己的 durable log（`feed_draft_revision`），不需要 World 的持久化與 replay。
- 真正可共用的是「帶重連的 LISTEN 工具」：`packages/db/src/libs/drafts/listen.ts` 寫成泛用的 `listenChannel(url, channel, onNotice, { signal })`，之後若要替 world-postgres 包一層 poll fallback 也能沿用。
- 保底：`draft:watch` generator 在 bus 靜默時每 5 秒查一次 `feed_draft.revision`，LISTEN 掛掉時退化成 server 端 polling 而非斷訊。

## 3. 風險與注意

- **附件渲染與 transcript 投影**（1.2）：渲染文字若不進 durable entry，`projectMessages` 必須能再渲染；否則直接存渲染結果。實作前先看 `packages/agent-runtime/src/session/` 的投影點再定。
- **NOTIFY 在交易內**：`pg_notify` 在 commit 時才送出，rollback 不會送，語意正確；但 drizzle 的 `tx.execute` 要確認在同一連線。
- **LISTEN client 與 drizzle pool 分開**：LISTEN 需要獨占連線，不可從 pool 借用。
- **oRPC event iterator 與 Hono timeout**：忘記加 `UNTIMED_PROCEDURE_PATHS` 會在 `TIMEOUT_MS` 後 504，但 handler 繼續跑（見 memory「Hono timeout does not cancel work」）。
- **RetryLinkPlugin 範圍**：只對 `draft:watch` 開啟，避免 mutation 被重送。
- **舊 session**：migration 把單一 draft 綁定搬成一列，`lastSeenRevision` 保留，行為連續。
- **正式環境 migration**：`feat/feed-draft` 的 `20260904115757_feed_draft` 尚未在正式環境跑，本計劃的 migration 疊在其後，合併時一起跑。

## 4. 工時估計

| Phase                    | 估計   |
| ------------------------ | ------ |
| 1 全域 agent             | 1.5 天 |
| 2 bus + watch + editor   | 1 天   |
| 3 drawer + composer 附件 | 1 天   |

## 5. 之後可做、本計劃不做

- WebSocket transport：`@orpc/server/crossws` handler 加 Nitro `features.websocket`，Hono 路由回傳帶 `crossws` 的 Response；dash 換 `@orpc/client/websocket` link。契約不變。
- `session:{id}` topic：把 agent 事件也搬到同一條訂閱，取消每 turn 一條 chat 串流。
- 衝突的逐段 diff 檢視。
