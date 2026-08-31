# Agent 架構與 Turn 流程

> 狀態：as-built
> 最後更新：2026-08-30
> English: [docs/agent-architecture.md](./agent-architecture.md)
> 相關文件：[docs/rag-architecture.md](./rag-architecture.md)

目前 agent stack 採 Pi-first：Pi 的 `Agent` 是執行引擎——provider loop、tool 執行、hook 與
model API——而 `@chia/agent-runtime` 擁有它周圍所有 durable 的東西：session tree、投影成
model context、compaction、navigation 與 fork。沒有 engine-neutral contract 或 adapter。
上線的 agent kind 有兩個：dashboard 裡的部落格寫作助理 `writing`，以及公開站上訪客對話的閱讀助理 `public`。

## 1. 分層

| 層           | Package / app                               | 責任                                                                                                                 |
| ------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Pi execution | `@chia/agent-runtime`                       | Pi turn 生命週期、session persistence、models/providers、approval hook、受限 wire events 與 client transport mapping |
| Shared tools | `@chia/agent-content`                       | 所有會讀部落格的 kind 共用的唯讀 content tools、它們的 `ContentReadPort`、名稱、標籤與摘要                           |
| Domain       | `@chia/agent-writing`                       | 寫作 tools、prompts、skills、model allowlist、policy、draft staging 與 domain ports                                  |
| Domain       | `@chia/agent-public`                        | 公開閱讀助理：在共用 content tools 之上的 prompt、policy、turn budget 與便宜 model allowlist                         |
| Host         | `apps/service`、`packages/api`、`apps/dash` | DB/KV/credentials、durable workflow 與 stream、oRPC service port、auth、UI                                           |
| Client       | `@chia/agent-elements`                      | 每個 session 一個 zustand store（fold wire events），以及兩個前端共用的 HeroUI chat elements                         |

```mermaid
flowchart TB
    dash["apps/dash<br/>agent workspace"] --> api["packages/api<br/>oRPC contracts · AgentKindService"]
    api --> service["apps/service<br/>durable workflow · host wiring"]
    service --> writing["@chia/agent-writing<br/>runWritingTurn · tools · prompts · policy"]
    service --> public["@chia/agent-public<br/>runPublicTurn · prompt · policy · budget"]
    writing --> content["@chia/agent-content<br/>search_posts · get_post · list_posts · list_tags"]
    public --> content
    writing --> runtime["@chia/agent-runtime<br/>runPiTurn · session · events · models"]
    public --> runtime
    content --> runtime
    runtime --> pi["Pi Agent"]
    runtime --> pg[("Postgres agent schema")]
```

`@chia/agent-runtime` 內部仍按關注點拆模組，但這些模組不是 provider-neutral facade。
`runPiTurn`、`createPiWireEventMapper`、`createPiToolCallGate` 的命名直接承認 Pi 依賴。真正
需要穩定的是送到 client 的受限 `AgentWireEvent`，不是可替換 engine 的假介面。

## 2. Agent kind 與 host service

`agent.session.kind` 是 domain discriminator（`writing`、`public`），不是 harness
discriminator。它選擇：

- 每個 process 在 `agents/factory.ts` 註冊的 `AgentKindDefinition`——service 端是 binding map，
  workflow 端是明確 switch；service 用它建立 oRPC kind service，workflow 則載入綁好 execution
  ports 的 sibling；
- `agent.writing_session` 這類 kind-specific extension row，藏在 `definition.state` 後面。

所有 session-scoped request 都從已持久化的 session 取得 kind；client 傳入的值只能交叉
驗證，不能拿另一個 kind 的 tools 去驅動既有 writing session。

`packages/api/orpc/services/agent.factory.ts` 宣告 typed construction environment，沿用 Hono
factory 的形狀：host 只需一次提供 per-kind bindings（`AgentKindEntry`——eager 的 `minTier` 加上
dynamic definition loader）與 credentials handling，factory 就能建立 stateless kind、admin 與
usage services。沒有 lazy delegate 或 definition cache；dynamic import 本身已經快取 module。
`BaseOSContext` 只攜帶這個 `agentFactory`，以及 DB 和 workflow control。

Generic service 與商業邏輯統一放在 `packages/api/orpc/services/agent/`：session rows、durable runs、
prompt/attach/stream、abort、approvals、compaction、rewind、usage 與 operator configuration。
`apps/service` 只提供 host bindings；turn step 則透過 `apps/workflow/src/agents/factory.ts` 解析綁好
execution ports 的 definition。一個 kind 就是 `apps/service/src/agents/` 下的一個檔案
（`writing.ts`），把 domain package 綁到 host 的 ports 上，只提供會不同的部分：`minTier`、
`label`/`description`、defaults、replay policy、model allowlist（`assert`/`list`/`resolve`）、
operator `config` 的 schema、capabilities、1:1 的 `state` row（`create`/`load`/`summary`/`detail`）
與 `runTurn`。Compaction 與 rewind 不屬於 kind：generic service 直接跑 Pi 自己的操作，模型由
compaction task 解析（§8）。Binding 上 eager 地重述 `minTier`（loader 會驗證兩者一致），guard
因此在 definition——以及它背後的 domain package 和 provider SDK——被載入之前就能拒絕低於門檻的
呼叫者；dynamic import 則讓這一切留在非 agent route 的 boot path 之外。

`AgentKindService` 是所有 kind 共有的形狀，不會為了某一個 kind 而長大。只有單一 kind 才有的
procedure 要開自己的 contract namespace（`agent.<kind>.*`）、在 `packages/api` 宣告自己的 port
interface，實作放在該 kind 的 definition 旁邊——不掛在共用 port 上，也不經過 generic delegate。
目前還沒有這種 procedure：writing 的 draft 跟著 session detail（`state.detail`）走，dashboard
讀的也只有它。

### 誰可以使用某個 kind

存取權是 kind 的屬性，不是 route 的屬性。每條 agent route 都先跑 `callerGuard()`，它只解析呼叫者的
`CallerTier`；接著 agent guard（建立與能力列表用 `agentKindGuard`，session-scoped 請求用
`agentSessionGuard`）把這個 tier 和 kind 註冊的 `minTier` 比對。低於 `Guest` 的 tier
一律先被拒絕——session row 有 owner，匿名或 API-key 呼叫者沒有可以「是」的人。沒帶 kind 的 `list`
只回傳呼叫者可用的 kind。

Service 收到的是 `AgentServiceCaller`：解析後的 `Caller`（tier、session、設定檔裡的 `adminId`）加上
`userId`。agent 的 generic 層不帶任何 admin 身分——writing kind 設 `minTier: Root`，這使得它的呼叫者
*就是*設定的作者，content port 需要時由 kind 自己讀 `getAdminId()`。公開 kind 設
`minTier: Guest`，從頭到尾看不到 admin id：它的 content port 是為設定檔裡那位作者的*已發佈*
文章建的——那是「誰的部落格」，不是「誰在問」。

### 公開 kind

`@chia/agent-public` 是公開站上的閱讀助理，綁定在 `packages/agent-host/src/public.ts`。它就是把
writing kind 裡所有會花錢或會改東西的部分拿掉：

- **Tools** 恰好是 `@chia/agent-content` 的四個 read tools，跑在 `public` visibility 的 port 上
  （§10）。只有一個 tier `read`；沒有東西需要 approval；沒有 `WebPort`、memory、draft。
- **Models**：gateway 這邊是一份封閉的便宜 id 清單（`HOUSE_PUBLIC_MODEL_IDS`——
  `claude-haiku-4.5`、`gpt-5-mini`、`gpt-5-nano`），不是 vendor prefix，因為目的就是不讓訪客選到
  同一家的旗艦。原生 OpenAI / Anthropic 則開放：帶自己 key 的訪客自己付錢，quota 也不算它（§3）。
- **Budget**（`publicTurnBudget`）：tool call 軟上限 6、硬上限 10、重複 2 次、兩分鐘。quota（§3）
  管一週，這個管 quota 最多會超出的那一個 turn。
- **State**：沒有。`state.load` 回 `{}` 讓 session 保持可見；公開 session 就是它的 transcript。fork
  不複製任何東西。
- **Config**：和 writing 一樣是 `instructions`——persona 與 house rules，接在穩定的 system prompt
  後面。

turn step 與 generic service 不需要任何 kind-specific 的東西：caller 低於 `Root` 所以 quota 與
running-turn cap 自動生效，title task 跑在 house model 上，compaction 跟著 session 自己的便宜 model。

### Guest

沒登入的訪客也能擁有 session：better-auth 的 `anonymous()` plugin（`@chia/auth/server`）在
client 呼叫 `signIn.anonymous()` 時鑄一個真正的 user row，標記 `user.isAnonymous`。
`callerPolicy` 把這種 session 評為 `CallerTier.Guest`——高於 `Anonymous`，因為有人可以擁有東西、
可以計量；低於 `ApiKey`，因為除此之外什麼都沒證明。單獨的 `sessionPolicy` 仍拒絕 guest，所以每條
`authGuard` route 一如既往地代表「登入的人」；只有 `callerPolicy` 選擇接納（`allowAnonymous`）。
guest 之後登入時，plugin 的 `onLinkAccount` 在 guest row 被刪除之前跑 `transferAgentOwnership`：
他們的 session、approval 與 ledger row 都搬到那個帳號，所以登入永遠不會重置配額。

`agent.usage.me`（`agentUsageStandingSchema`）是任何帶 session 的 tier 自己的處境：額度、花費、
當週、執行中的 turn 與上限——operator 的上限是 `null`——經由 `agentFactory` 建立的 usage
service 讀取 `@chia/agent-host/quota` 的 `readAgentUsageStanding`。

## 3. Policy、session 與資料

### Tool policy

每個 domain 以 `AgentPolicy` 提供 `tierOf`、`labelOf`、`requiresApproval`、
`changesState`、`summarize` 與 optional state scope。Tier 維持 string，因為其字彙由 domain
擁有。Writing agent 使用：

| Tier     | 意義                       | Approval | `state:changed` |
| -------- | -------------------------- | -------- | --------------- |
| `read`   | 讀取與 outbound fetch      | 不需要   | 否              |
| `draft`  | 可逆的 staging-buffer 寫入 | 不需要   | 是              |
| `commit` | 寫入正式 feed/content      | 需要     | 是              |

未知的 writing tool 會落到最嚴格的 tier。

### Session tree 與資料表

Transcript 是樹而不是 flat log。`agent.session_entry.parentId` 指向 branch 上一個 entry，
`agent.session.leafEntryId` 選定 active leaf。`PgSessionStorage` 把 runtime 自己的
`SessionTree` 合約（`packages/agent-runtime/src/session/tree.ts`）實作在這些表上，因此可以
rewind 並建立 alternate branch；`InMemorySessionTree` 是同一合約的測試用實作。

```text
agent.session                  共用 settings、kind、active leaf
agent.session_entry            session-tree nodes（`SessionEntry`）；`seq` 是跨所有 branch 的落地順序
agent.run                      durable execution metadata；每個 session 最多一個 active run
agent.tool_approval            durable approval 與 audit trail
agent.writing_session          writing-specific 1:1 state
agent.writing_draft            每個 locale 的 staging buffer
agent.memory                   跨 session 的長期記憶（§10）；索引進 `resource_chunk`
agent.kind_config              operator 對 kind 的 defaults 與 config 的覆寫（§13）
agent.task_config              operator 對 task 的 model、prompt 與參數的覆寫（§13）
agent.usage_ledger             替使用者做的每一次 provider call 一列；session 刪了它還在
agent.quota_config             operator 對每週額度與其時區的覆寫（§3、§13）
```

Entry payload 是符合 Pi session-entry union 的 opaque JSON。Kind-specific state 以 extension
table 表達，不把共用 session table 擴成大量 nullable columns。

### Usage ledger

替使用者做的每一次 provider call 都在 `agent.usage_ledger` 落一列：turn 的回覆、自動與手動
compaction、branch summary、session title、lesson 抽取——不論誰付錢。`provider_id` 說明這筆
是誰的帳（house gateway 或 BYOK key），所以「只算 house 花費」的配額是一個 filter，不是第二
本帳。每列帶 pi 自己的 `usage`（input、output、cache read/write、reasoning）和它的
`cost.total`，以整數 micro-dollar 存：計量一律用 cost，不用 raw tokens——cache read 只有
uncached 的十分之一價錢，而長對話每一回合都重送整份 transcript。

數字不從 `session_entry` 反查，雖然每則 assistant message 都帶著它們：entry 隨 session
cascade，使用者刪掉 session 就等於抹掉自己花掉的；payload 是 opaque 的、索引按 session 而不
是按 user 與期間；side job 根本沒有 entry。Ledger 的 `session_id` 是 `set null`，歸屬於 session
的擁有者——匿名訪客一旦有了 user row 也是同一個人。

Runtime 回報，host 寫入。`runPiTurn`、`compactSession`、`navigatePiSession` 接一個
`AgentUsageListener`（`@chia/agent-runtime/types`），在 entry 落地**之後**用回答的模型、usage
與 entry id 呼叫它，所以不會有一列先於它所記的東西；`completeText` 與 `generateSessionTitle`
不論回了什麼都回報被計費的量，因為中斷的 stream 一樣要付錢。每條 host 路徑都把 listener 綁到
`recordAgentUsage`（`@chia/agent-host/usage`）：turn step（turn、它的自動 compaction、title）、
generic service 的 maintenance 操作（手動 compaction、branch summary——在 session lock 的
transaction 上）以及 lesson step。寫入永遠不在 critical path 上：provider 沒計費的 call 不成
列，insert 失敗只記 log 然後丟掉，損失最多一次 call，且對使用者有利。

### Usage quota

配額是 caller tier 的屬性，從 ledger 讀出來。`Root`——付帳的 operator——永不受限；其他每個
tier 共用一份每週的 **house** 花費額度：`sumAgentUsageCost` 取這一週、過濾到 gateway
provider，所以 BYOK 的 call 會被記錄但算使用者自己的帳。`@chia/agent-host/quota` 擁有它：
`AGENT_QUOTA_DEFAULTS` 是每週 $0.30、以 server 自己的時區計；operator 的 `agent.quota_config`
row 從 dashboard 覆寫任一項（`agent.admin.quota.*`，§13）；`weekPeriod` 是該時區的週一 00:00
到下週一 00:00，以該時區的日曆邊界計算，所以碰上 DST 的那週是 167 或 169 小時而不是算錯一天；
`assertWithinAgentQuota` 在這週的花費達到上限時丟 `QUOTA_EXCEEDED`（402，
`{ limitMicros, usedMicros, resetAt, timeZone }`）。

只在接受 model call 的地方檢查，別處不檢查：`prompt` 與 `approve`（一個決定會起一個 relay
turn）、branch 有東西可濃縮時的 `compact`（無事可做的 `compact` 直接回 `CONFLICT`，不需要
quota）、帶 `summarize` 的 `navigate`——都在 session lock 之下、在任何東西被排入或
落地之前，所以被拒絕的 approval 會維持 pending，等下週再決定。上限是 soft 的：只要還有剩就
接受，所以最後一次最多超出一個 turn，由 kind 的 turn budget 兜住。上限設 `0` 就對所有受限
tier 關閉 agent。

額度之外還有 **執行中 turn 上限**（`maxRunningTurns`，預設 3，同一個 row）：限制一個受限
caller 同時能壓在 single-replica runner 上的量。`prompt` 與 `approve` 數這個使用者 turn
marker 為 `running` 的 active run（`countRunningAgentTurns`），到上限就以
`TOO_MANY_REQUESTS`（`{ runningTurns, maxRunningTurns }`）拒絕。計數在使用者自己的 advisory
lock 之下（`lockAgentUser`，永遠在 session lock 之後、同一個 transaction），所以兩個 session
上的兩個 prompt 不會用同一次讀數都通過。排在該 session 執行中 turn 後面的訊息不增加執行中
的 turn。

Marker 本身不是真相：process 在 step 底下死掉不會清掉它。所以每個讀取端都會問 World 那個 run
是否還活著（`packages/api/orpc/services/agent/run-liveness.ts` 的 `runStateOf`），而在
數上限之前——以及 `usage.me` 回報之前——`reconcileRunningAgentTurns` 會把這個使用者 marker
還在、run 卻已經不在的 row 收掉（標 `failed`、釋放 controller）。Workflow 自己也在 `finally`
裡收 row（`completeAgentRunStep`，step 丟錯就標 `failed`），所以 stale row 只可能是 World 還沒
放棄的那種。

### Session title

`agent.session.title` 是 operator 辨識 session 用的名稱：尚未命名時為 `null`，之後不是 operator
自己取的（`settings:update`），就是從第一則 prompt 精簡而來。Turn step 會在未命名 session 的第一個
operator turn 旁邊同時命名（`apps/workflow/src/steps/agent-turn.step.ts` 的 `titleSession`）：
`@chia/agent-runtime/pi/title` 的 `generateSessionTitle` 問 `session.title` task 的模型（§13）——
預設是 house gateway 的便宜模型，operator 可以改釘別的；不用 session 自己選的模型，那可能是
BYOK——模型失敗時退回 prompt 第一行，所以一定會有標題。
兩個 invariant：寫入走 `setAgentSessionTitleIfUnset`（`WHERE title IS NULL`），第一輪進行中
operator 的 rename 永遠贏過自動產生的標題；turn 的 `run:end` 會等到標題落地才寫出（上限
`SESSION_TITLE_TIMEOUT_MS`），client 在 turn 結束時重抓 session 列表就已經看得到。Operator
decision 的 relay turn 不命名。

## 4. 一個 turn 的完整路徑

```mermaid
sequenceDiagram
    participant UI as apps/dash
    participant RPC as oRPC
    participant SVC as createAgentKindService(writing)
    participant WF as agentSessionWorkflow
    participant STEP as runAgentTurnStep
    participant WR as runWritingTurn
    participant PI as runPiTurn / Agent
    participant PG as Postgres

    UI->>RPC: agent.sessions.chat (prompt)
    RPC->>SVC: prompt(caller, input)
    alt 已有 active durable run
        SVC->>WF: resume message hook
    else 沒有 active run
        SVC->>WF: start workflow
        SVC->>PG: create agent.run
    end
    SVC-->>RPC: runId + stream cursor
    RPC->>SVC: stream(caller, cursor)
    WF->>STEP: execute turn step
    STEP->>WR: runWritingTurn(options)
    WR->>PI: runPiTurn(concrete Pi inputs)
    PI->>PI: new Agent(...).prompt(...)
    PI-->>UI: bounded durable AgentWireEvent stream
    PI->>PG: session entries 與 domain writes
    STEP-->>WF: done / aborted / error / awaiting_approval
```

### Enqueue 與 durable driver

oRPC route 先解析呼叫者的 tier，session guard 再驗證 ownership 與 kind 的 `minTier`。Host service 會透過 reusable
message hook 把訊息持久化到既有 workflow 的 event log，或建立新 run。Workflow 在第一個
turn 前以 `getConflict()` 註冊 inbox，因此 running turn 期間送入的訊息會排隊，等目前 turn
以及可能的 approval handshake 完成後成為下一個 turn。仍有 pending approval、workflow
尚在啟動而 hook 未註冊，或文字是保留的 `/end` sentinel 時會拒絕 enqueue。

每個 durable workflow run 最多驅動 200 turns。Workflow function 在 sandboxed VM 執行；
DB、provider、timer 與 network 都留在 step，跨 boundary 的只有 plain data。這讓 turn、
approval pause 與 stream replay 可以跨 deploy 或 process restart 存活。

`runAgentTurnStep` 的 `maxRetries = 0` 是刻意的：完整 turn 可能已寫入 session entry、draft
或執行已核准的 side effect，無法安全 replay。Provider retry 由 Pi 處理；turn 失敗後保留
partial transcript，等待 operator 重新 prompt。

### Concrete execution path

Production 只有一條執行路徑：

```text
runAgentTurnStep → runWritingTurn → runPiTurn → new Agent
```

`runWritingTurn` 建立 writing tool context，從 caller credential 所屬的 `Models` resolve
model，並組合 tools、templates、穩定的 system prompt、每次請求都重算的 volatile context 與
writing policy。

`runPiTurn` 負責完整生命週期：

1. 讀 leaf 與它的 branch，用 `buildBranchContext` 投影成 messages，依 resolved model clamp
   thinking level，綁定 tool context，為這個 turn 建立一個 `Agent`——它的 stream function 綁在
   caller 自己的 `Models` 上，絕不是 process-wide 的 default；
2. 安裝組合了 turn budget 與 approval gate 的 `beforeToolCall`（budget 先——被 budget 拒絕的
   呼叫絕不能產生 approval）、附加 volatile block 的 `transformContext`、發 state-change 通知的
   `afterToolCall`、host 的 abort signal、turn deadline，以及 Pi-to-wire event mapper；
3. 訂閱一次：每個 `message_end`——user prompt、assistant 回覆、tool result——都在 wire event
   送出**之前**以 turn 的 cursor 為 parent append 進 tree，client 不會看到 tree 沒存的訊息；
4. emit `run:start`、user event，再以 operator 的文字或展開後的 template 呼叫 `prompt`；
5. 檢查最後一則 assistant message：`stopReason: "error"` 是分類過的 provider 失敗，
   `"aborted"` 讓 turn 以 aborted 結束；拋出的例外或 hook 記下的 host failure 歸為 `internal`；
6. provider turn 成功後，原子批次持久化所有 approval snapshots，再 emit 對應的
   `approval:request`；
7. 只在成功且沒有 pending approval 時 auto-compact（`compactSessionIfNeeded`），並發
   `session:compacted`；
8. emit terminal error/end，解除 subscriptions，最後 flush durable writer。

### Turn budget

Pi 的 loop 沒有 step 上限：只要 assistant message 還帶 tool call 就繼續跑，所以一個不斷重發
同一個呼叫的模型會一直跑到 operator abort 為止。因此每個 kind 都要傳入 `AgentTurnBudget`
（writing 的是 `@chia/agent-writing/policy` 的 `writingTurnBudget`），由 `createPiTurnBudget`
（`packages/agent-runtime/src/pi/turn-budget.ts`）在 `tool_call` hook 上、approval gate 之前
執行：

| 上限               | 越過時                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `maxRepeats`       | 同一個 tool 以完全相同的參數連續呼叫這麼多次——以 tool error 拒絕，告訴模型結果不會改變                                            |
| `maxToolCalls`     | 之後每個呼叫都以 tool error 拒絕，要模型用現有結果作答                                                                            |
| `hardMaxToolCalls` | 模型無視拒絕繼續呼叫——abort run，turn 以 `error{budget_exhausted}` 結束                                                           |
| `maxDurationMs`    | 模型生成階段的 wall-clock——同樣 abort 與 error；reply 一回來就清掉，之後的 host 工作（approval 持久化、compaction）不會被它判失敗 |

拒絕是透過 tool result 跟模型對話，與 approval gate 用的是同一條通道，所以會聽話的模型會正常
結束這一輪。兩種 abort 走的是與 volatile-context 讀取失敗相同的 host-failure 路徑：記下失敗、
abort run，turn 以該 error 結束而非 `aborted`。per-user 與 per-session 的配額不在這裡——
那屬於 enqueue 時的 kind service，讀的是 usage ledger（§3）。

### Prompt 分層

System prompt 在一個 session 內是穩定的——規則、skills 索引、approval posture——因為它位於
每個 provider request 的最前面，一變就會讓 system prompt、tool schema 與其後整段 transcript
的 cached prefix 失效。每個 turn 會變的東西（draft 狀態、時鐘、本 session 已存的記憶）是
**volatile context**：透過
Pi 的 `context` hook 附加為每個 provider request 的最後一則 user message，不持久化，因此永遠
是最新的，也不會累積在 transcript 裡。模型必須看到最新狀態的東西放這裡，不放 system prompt。

### Abort

Workflow SDK 沒有任何東西能碰到已經在執行的 step——取消 run 只是讓它不再被排程——所以 stop
是透過第二個很小的 durable run 送達：session run 的 **abort controller**
（`apps/workflow/src/workflows/agent-abort.workflow.ts`）。`prompt` 在開 session run 之前先開它，
並把 `{ id, runId }` 放進 session run 的 request（與 `agent.run.metadata`）；它停在
`agentAbortHook` 上，被 resume 時往自己的 stream 寫一則訊息。每個 turn step 直接以 run id 訂閱
那條 stream——不查詢，所以一個 session run 恰好一個 controller——把得到的 `AbortSignal` 交給
`runPiTurn`，turn 結束時釋放訂閱。
`abort` 先 resume 這個 hook，再取消 session run、把 `agent.run` 列標成 `cancelled`；
`completeAgentRunStep` 也會 resume 它，讓跑完的 run 不會留下一個停到 TTL 的 controller。Signal 一
觸發 run 立刻中止，生成到一半也一樣：Pi 取消進行中的 provider stream，部分回覆以 `aborted`
持久化，turn 以 `run:end{aborted}` 結束；不持久化 approval，也不 compaction。已經在執行的 tool
只會收到 signal——Pi 會等它返回——所以 `abort` 會先從 marker 的 `streamIndex` tail 這個 turn 自己
的 durable stream 直到 `run:end`（上限 `ABORT_SETTLE_TIMEOUT_MS`）才取消 run：client 在 `abort` 回
來的瞬間就重建 transcript，而每一筆 entry 都是先 append 再發 wire event，所以讀到 `run:end` 就代表
被中止的 turn 已完整落地。送達走的是 SDK 自
己的 durable stream，所以跨 process 也成立——沒有 registry、沒有 timer、沒有第二條 channel。下一
次 prompt 會在持久化的 transcript 上開新 session run。過期（TTL）的 controller 不會中止任何 turn；
reader 忽略 `expired`，下一個 turn 會建新的。

### Pi hook 裡的 host 失敗

Hook 拋錯時 Pi 會把它收進自己的錯誤表面——`beforeToolCall` 變成 error tool result、
`transformContext` 變成 `stopReason: "error"` 的 assistant message——跟 provider 失敗長得一樣。
因此 `runPiTurn` 安裝的 hook 都自己攔錯、記成 host failure 並中止 run，turn 以 `internal`
收尾。Volatile context 讀失敗就是這樣結束，而不是讓模型在看不到目前狀態的情況下繼續動作。

## 5. Approval handshake

Pi tool hook 會用 tool error block 需要核准的 call。這個拒絕是刻意的 durable handshake：
turn 以一致狀態結束，不會停在 deploy 後就消失的 in-memory promise。

```mermaid
sequenceDiagram
    participant M as Model
    participant G as createPiToolCallGate
    participant R as runPiTurn
    participant WF as Workflow
    participant OP as Operator
    participant DB as agent.tool_approval

    M->>G: commit tool call
    G-->>M: blocked；停止並等待核准
    G-->>R: 收集 request
    R->>DB: 原子批次持久化收集到的 requests
    R-->>WF: 持久化成功後 emit approval:request
    WF->>WF: park on approval hook
    OP->>DB: persist decision
    OP->>WF: resume hook
    WF->>M: acknowledge / execution turn
    M->>G: re-issued call
    G-->>M: 本 turn pre-authorized，放行
```

四種放行條件是：tier 不需核准、tier 在 session `autoApprove`、tool call id 已持久化核准，
或 tool name 僅在本 turn 被 pre-authorize。Decision 一定先寫 DB 再喚醒 workflow。Rejected
request 也會有一個後續 turn，讓 agent 回應 operator comment。

Approval request 只會在 provider turn 成功且整批 request 完成持久化後發布。Provider 或
persistence 失敗會回傳沒有 undecided approval rows 的 `error` turn，因此 workflow 不會等待
一個實際上無法 resume 的 hook。

## 6. Wire events 與 streaming

`packages/agent-runtime/src/pi/events.ts` 是 live narrowing point。Raw Pi event 可能攜帶完整
model、每個 delta 的 partial snapshot 與不受控 details；client 只收到：

```text
run:start · user · assistant:start · assistant:delta · assistant:end
tool:start · tool:update · tool:end
approval:request · approval:resolved
session:compacted · session:rewound · state:changed · error · run:end
```

- 訊息的 `messageId` 就是它的 session entry id，live 與 replay 一致。`runPiTurn` 在訊息開始時
  預留 id（operator 的 prompt 在 Pi 開始之前就先預留），append entry 時用同一個 id；
  `createPiWireEventMapper` 向 turn 要這個 id——所以 client 可以把任何一則訊息的 id 交回去當
  rewind 或 fork 的目標，重整後 rebuild 的 transcript 也用同樣的 id 稱呼同樣的訊息。
- `entriesToWireEvents`：persisted Pi entries → replay history。`stopReason: "error"` 的持久化
  assistant message 會 replay 成與 live turn 相同的 `error` event；`branch_summary` entry 會
  replay 成 `session:rewound`，所以帶摘要的 rewind 會留在它發生的位置。
- Transcript 是 leaf 的完整祖先鏈（`walkTranscript`），穿過每一次 compaction：compaction 濃縮的
  是送給模型的東西，不是說過的話，所以它背後的訊息留在畫面上，`session:compacted` 的提示落在
  它發生的位置。只有模型的 context——`buildBranchContext`、`stats.contextTokens`、
  `stats.compactable`——讀 branch（`walkBranch`），在最近一次 compaction 停下。
- Tool call 只在 `tool:start` 與 `tool:end` 之間是 `running`，而兩邊都保證 end 一定會到。Pi 把
  call 的結果緊接在發出它的 assistant message 之後持久化，所以 replay 遇到結果不是 branch 上下一
  筆的 call——turn 在執行中被中止、process 死掉、fork 切在 assistant message 上——就以
  `tool:end{aborted}` 收掉；`error` 或 `aborted` 收尾的 message 裡的 call 則直接略過，Pi 從沒執行
  它們，live turn 也沒顯示過。`run:end` 對 live turn 留下的 running call 做同樣的事。`aborted` 是
  獨立的狀態而不是 `isError`：tool 沒有失敗，它只是沒跑完。
- `error` 只帶 `kind`（`auth · quota · rate_limited · context_overflow · budget_exhausted · provider ·
internal`）：client 據此挑 headline；provider 或 host 自己的錯誤文字連同 throw 出來的東西只進
  server log（`Agent turn failed`），不上 wire。
- `tool:end.details` 上 wire 前會經過 `clipDetails`——長字串、陣列、寬物件與深巢狀就地縮短、
  保留形狀——因為每個 coarse event 都是 durable write，且會 replay 給每個重連的 client。模型
  讀的是 tool 的 `content`，不是這份副本。
- `applyEvent` / `foldEvents`：讓 live 與 replay 共用同一條 client rendering path。
- `agent.sessions.chat` 是唯一的 turn transport：透過 kind service enqueue prompt 或 approval
  decision，再從回傳的 cursor tail run 的 durable stream，原樣送出 wire events，到該 turn 的
  `run:end` 為止。History 由 `agent.sessions.get` 以同樣的 wire events 回傳，client 用同一個
  reducer fold 兩者。
- `@chia/agent-elements` 就是那個 client：每個 session 一個 zustand store
  （`createAgentSessionStore`）只管 live 這一段——用 `applyEvent` fold live turn、prompt/approval
  的 stream loop——request/response 的部分（session detail、models、settings、abort）走 host 的
  TanStack `QueryClient`（`./queries`），store 也是透過同一個 cache 讀寫 detail；再加上兩個前端
  共用的 HeroUI elements（thread、composer、approval card、model picker、session tabs、message
  actions）。它只吃 contract-typed 的 `client.agent`，不依賴任何 app。

每個 run 有 coarse durable stream 與獨立 batch 的 delta namespace。Coarse event 會先 flush
pending deltas；reader 以 race 讀取兩邊以維持交錯順序。Stream 只在整個 durable run 結束時
關閉，不會每個 turn 關閉。

### 重新接上執行中的 turn

Chat 是 server-authoritative：session store 在 mount 時從 `agent.sessions.get` hydrate，若
`run.status` 是 `running`，就用 `agent.sessions.chat` 的 `{ type: "attach" }` 接回那個 turn。
以 `run:end` 結束的 stream 只重新抓 session detail（保留它自己 fold 出來的 view；下面的
marker 可能比 terminal event 晚一點清掉，所以那次讀取會短暫重試）；更早斷掉的 stream 則從
`get` 重建並帶 backoff 重新 attach。Turn step 維護 `agent.run.metadata.turn`——turn 開始前
最新的 entry `seq`（`seqBefore`）、它要寫的第一個 coarse stream index，以及 `running`（進
handler 前設、`finally` 清）。最後這個 workflow SDK 給不了：對 SDK 來說停在 message hook 上的 run 和正在跑 step 的 run
都是 `running`，所以 `run.status`、`attach` 與 compact/rewind 的檢查都改讀這個 marker。Turn 執行
中時 `get` 只 replay `seq <= seqBefore` 的 entries，`attach` 則從那個 index tail stream；兩邊
用同一個 marker，所以在 turn 進行中重整頁面，每則訊息只會出現一次，turn 也會原地跑完。用
seq 而不是 turn 前的 leaf id：rewind 之後 leaf 不是最新的 entry，用 seq 切也不必猜 marker
落在哪條 branch 上。`prompt`
與 `approve` 在接受一個 turn 時就自己寫 marker——新 run 是 lease 的一部分（§8），parked 的 run
則在叫醒 hook 之前——所以 turn 從被接受那一刻起就算 running；step 開始時會重寫同樣的值。
唯一例外是排在一個正在跑的 turn 後面的訊息，它要等自己的 step 開始才會被標記。

## 7. Durable message inbox

每個 session workflow 建立一個 deterministic、reusable `agentMessageHook`。Workflow 會在
第一個 Pi step 前 await `getConflict()`：這既把 hook 註冊到 workflow backend，也阻止兩個
active runs 同時擁有同一個 session inbox。

Active run 收到 prompt 時，service 直接 resume 這個 hook。每筆 payload 都成為 durable
`hook_received` event，因此不需要 Postgres pending table、Redis Pub/Sub、process-local queue
或 timer polling。Workflow 依 event-log 順序一次讀取一筆，再呼叫 `runAgentTurnStep`。

Pi agent 仍完整位於單一 step 裡，所以 queued message 不會中斷目前正在生成的 turn；它會
在目前 turn 與任何 approval handshake 結束後成為新的正常 turn。這是刻意選擇的產品語意，
也讓 workflow event log 成為唯一 message queue。

## 8. Compaction 與 navigation

Maintenance 直接操作 session tree，不建立 `Agent`：

- `compactPiSession` 對 branch 跑 Pi 的 `prepareCompaction` 與 `compact`，把 compaction entry
  （summary、retained tail、usage）append 成新的 leaf。沒有東西可以濃縮時回 `null`、不呼叫
  模型：Pi 會把最新的 `keepRecentTokens` 整段保留，所以塞得進這段尾巴的 branch 壓下去只會被收
  一次 summary 的費用、context 反而變大。`canCompactBranch` 是同一個判斷的獨立版本；session
  detail 以 `stats.compactable` 回報它，為 false 時 service 對手動 `compact` 回 `CONFLICT`。
  手動 `compact` 跟 `navigate` 一樣回傳整份重建的 detail，因為 leaf、context 估算與 transcript
  都變了；
- `navigatePiSession` 搬 leaf（目標是 user message 時搬到它的 parent，讓它可以重問），需要時
  用 Pi 的 `generateBranchSummary` 把被丟下的 entries 總結成新 leaf 底下的 `branch_summary`，
  label 則記錄下來但不讓 leaf 停在 label 上；
- fork（`PgSessionRepo.fork`）複製到新的 session row：沒指定目標時複製整棵樹並沿用來源的 leaf；
  指定目標時複製目標以下、從最近一次 compaction 起的 branch——`at` 包含目標，`before`（僅限
  user message）停在它的 parent，讓那句話可以重問。Row 上記錄血緣（`forkedFromSessionId`、
  `forkedFromEntryId`），session list 帶出來讓 tabs 能顯示分支來自哪裡；
- generic service 直接呼叫這兩個操作，模型由 `session.compaction` 或 `session.branch-summary`
  task 解析（§13）：預設是 session 自己的模型——透過 kind 的 `models.resolve` 與 caller 帶
  credentials 的 collection——或 operator 釘的 house model；後者完全不碰 session 的模型，也就
  不需要它的 BYOK key。

Maintenance 不建立 tools、prompts、approval 或 subscriptions。

兩個操作回答的是兩個不同的問題。**Navigate**（`agent.sessions.navigate`）是原地 rewind：同一個
session，leaf 往回搬，被丟下的 branch 留在樹裡但看不到——client 只顯示一條 active branch。
**Fork**（`agent.sessions.fork`）兩邊都留：複製落在新的 session，來源不動，operator 透過 session
tabs 在兩者之間切換。Generic service 實作這兩者：navigation 走 `navigatePiSession`，fork 走
`repo.fork` 加 `definition.state.fork`——後者複製 kind 的 state row，writing 的話連 draft 一起，
失敗時的 compensation 與 `createSession` 相同。

兩者在 turn running 與 approval 未決時都會被拒絕（`CONFLICT`）：run 停在 approval hook 上，
決定之後啟動的 relay turn 會落在當時的 active branch，回覆一個已經不在 branch 上的 call。手動
compaction 共用同一個 guard。Guard 的可靠度取決於順序，所以接受 turn（`prompt`、`approve`）
與 maintenance 用同一把 per-session 的 Postgres advisory lock（`withAgentSessionLock`）序列化，
而新 run 的 `agent.run` row 會在 workflow 啟動**之前**就寫下——在 `start` 回來並綁定
（`bindAgentRunExternalId`）之前，row 自己的 id 先代替 workflow run id；超過一分鐘還沒綁定的
row 視為死掉。因此在 prompt 之後拿到鎖的 maintenance 一定已經看到 running 的 turn，而在
maintenance 期間到達的 prompt 會等它的寫入完成。鎖裡的所有工作都走鎖所在的那條連線
（transaction 的 `tx`），所以一個操作不會在持鎖時又去等第二條 pool 連線。Marker 寫入與 run 的
完成都以 row 自己的 id 定址，這個 id 以 `runId` 帶進 workflow：被取消又被取代的 run，它的 step
永遠碰不到取代它的那個 run。Navigation 回傳的是整份 session detail 而不只是
events，因為
active branch 改變後 client 手上的 view 全部失效，而 client fold 一份 detail 的方式跟 fold `get`
一模一樣。

兩者都在 request 裡帶著一次模型呼叫（summary），所以 RPC route 把它們跟 chat stream 一樣排除在
共用的 request timeout 之外（`rpc.route.ts`），改由 service 自己設限：`MAINTENANCE_DEADLINE_MS`
以 signal 交給 Pi 的 summary，時限一到 summary 被取消、什麼都不 append、transaction 回滾、caller
拿到 `TIMEOUT`。共用的 timeout 只會在工作與 session lock 照跑的情況下把回應換成 504。鎖裡的
查詢也一次一個：transaction 是單一連線，pg 對忙碌中的 client 再下一筆 query 會排隊——而且已列為
deprecated。

Kind state 沒有隨 transcript 版本化：rewind 之後 writing draft 停在被丟下的 branch 最後的狀態，
fork 複製的是「現在」的 draft 而不是目標當時的；dialog 會講清楚，per-entry snapshot 的 seam 在
`AgentKindState`。

Turn 成功結束時，`compactSessionIfNeeded` 以 session 模型的 context window 套用 Pi 的 context
token estimate 與 threshold，總結用的模型與手動 compaction 相同、來自 compaction task
（`RunPiTurnOptions.compactionModel`）。Failed turn 或 awaiting approval 的 turn 不會
auto-compact；compaction failure 也不會讓成功的 turn 變成失敗。

## 9. Models 與 credentials

`Models` 依 caller/turn 建立。BYOK provider 只有 caller 提供 key 時才註冊，避免 Pi fallback
到 service 中為其他用途存在的 ambient provider key。Selected model 必須從同一個帶
credentials 的 collection resolve；turn 把 `Agent` 的 stream function 綁在同一個 collection
上，絕不用 process-wide 的 `setDefaultStreamFn`。

Writing package 擁有自己的 model allowlist。Gateway、OpenAI、Anthropic catalogues 由 Pi
提供；domain 決定允許哪些 `(providerId, modelId)` pair。

## 10. Writing domain 與 durable state

Writing agent 透過 `ContentPort`（`@chia/agent-content` 的 `ContentReadPort` 加上寫入）讀內容、
透過 `WebPort`（`web_search` 找來源、`fetch_url` 讀頁面）連外、透過 `MemoryPort` 跨 session
記憶、透過 `DraftStore` 寫 staging buffer；只有 commit-tier tool 會把 staged data 提升到正式
feed/content。刪除內容與圖片上傳不
開放給 agent。`WebPort` 由 host 用 Firecrawl 實作（`apps/workflow/src/services/agent-web.port.ts`、
`FIRECRAWL_API_KEY`）：search 只回 snippet、不逐筆 scrape，所以每次呼叫成本固定；`fetch_url`
是一頁一次 scrape、回主要內容的 markdown，模型要讀哪一頁自己決定。Agent 路徑上沒有直接對外的
fetch。兩個 tool 都把 turn 的 abort signal 交給 port；Firecrawl SDK 無法取消 request，所以 port
在 signal 一觸發就以它的 reason settle、讓 request 在背景跑到 timeout——被中止的 turn 在 signal
觸發時就結束，而不是等頁面回來。`buildSystemPrompt` 是穩定的
system prompt，`buildTurnContext` 是帶 draft 狀態與目前時間的 volatile block（見 §4）；skills
與 templates 位於 `packages/agent-writing/src/prompts/`。

### 記憶

`agent.memory` 是唯一活得比 session 久的表。三種 kind、三種生命週期：`source` 是 `fetch_url`
讀過的頁面（URL、標題、整頁文字，上限 64k 字元），`fact` 是模型用 `save_memory` 留下的蒸餾過、附出處的結論，
`lesson` 是從 operator 的回饋抽出的寫作偏好。`MemoryPort`（`@chia/agent-writing/ports`）
整個由 host 實作（`apps/workflow/src/services/agent-memory.port.ts`）：寫入走
`packages/api/memories/write.ts`，索引 hook 是必填參數（同 `feeds/write.ts`），每次改到 row 的
寫入都對 `agent_memory` 這個 resource type 排一次 `indexResourceWorkflow`（`docs/rag-architecture.md`
§2.4）——文字沒變的 `source` 重訪不排，除非索引比 row 舊（`isResourceIndexedSince`），那是 hook 曾經失敗——首次或改動之後——時的補救。只有
live 且 `active` 的記憶會被索引：pending 的 lesson 未經審核，而索引就是 agent context。`save_memory` 歸 `draft` tier——可逆、部落格看不到——而且只寫 `fact`。

`fetch_url` 讀過的每一頁都經同一個 port 留下一筆 `source`——URL、標題、整頁文字（上限 64k
字元）——以 URL 為 key，重訪是更新不是重複。存整頁而不是摘錄，因為 RAG 管線本來就是為文件設計
的：帶 heading path 的 section 給檢索、outline card 回答「這頁在講什麼」、`get_memory` 像
`get_post` 一樣把長頁面降階。留痕在 fetch 之後寫、永遠不會讓 fetch 失敗：模型拿到的結果有沒有留痕
都一樣。Volatile context（§4）列出本 session 已存的記憶，一筆一行、有上限、附 id，模型才不會
重複存，也知道可以 `get_memory` 拿回已經有的東西——`source` 以 host + path 顯示而不是標題：標題
是網頁自己的，否則每個 request 都會被重述一次。

`fact` 與 `source` 只透過 tool 進到模型眼前，不進 system prompt：`search_memory` 是限定
`sourceTypes: ["agent_memory"]` 加 `includeUnpublished: true` 的 resource search——兩個旗標
必須同時設，因為每個記憶 chunk 都以 `published: false` 索引；`get_memory` 讀單筆。一次檢索
就是一次看得見的 tool call、一次看得見的成本。Port 上的兩個 list 方法是給 volatile context
用的，那裡只拿得到 port。

`lesson` 是唯一 always-on 的一種：volatile context 在 `# Learned preferences` 底下列出最近
更新的 20 條 **active** lesson 的標題——要模型記得去查的偏好，不是它會遵守的偏好。Lesson 由
`memoryConsolidationWorkflow`（`apps/workflow/src/workflows/memory-consolidation.workflow.ts`）
產生：writing kind 的 `runTurn` 在一個執行過 `commit_draft` 且以 `done` 結束的 turn 之後啟動它
——只有這時 transcript 才含完整的修改往返——或從 dash 手動啟動（`memory.consolidate`）。它唯一的
step 沿 `parentId` 讀 session 的原始 entries、穿過 compaction，只保留 operator 的訊息與 assistant
的文字（永遠不含 tool result，所以網頁說的話成不了 lesson），用 `writing.lessons` task 的 prompt
請它的模型（§13；預設是 house gateway 的便宜模型，operator 可以改釘別的）以 JSON 回最多三條新
lesson。每條 lesson 落地即 `pending`，operator 在 dash 核准前不注入任何地方：
沒有任何未經人眼的文字能常駐 prompt。抽取的純函式在 `@chia/agent-writing/memory/lessons`；step
是 `maxRetries = 0`——模型失敗本來就是「沒有 lesson」，寫到一半重試只會重複。

Dash 的記憶頁（`apps/dash/src/app/(workspace)/memory/`）是 client-only oRPC，每條 `memory.*`
procedure 含唯讀都在 `adminGuard()` 後面：記憶是未發布的研究，active lesson 是常駐指令。所有
寫入走 `memories/write.ts`，所以編輯、封存、刪除都會重新索引。

### 內容可見性

Read tools 無法擴大自己能看到的範圍：可見性在 host 建 port 時就固定
（`packages/api/agents/content-read.port.ts`）。`author` port 看得到設定作者的草稿；
`public` port 把每次 detail read 都限定在 `published: true`，被要求列草稿時回空而不是覆寫
filter。搜尋不需要分支——chunk index 對所有呼叫者都只含已發佈內容。Writing agent 的 port 是
`author`；公開 kind 的是 `public`（`apps/workflow/src/agents/public.ts`），而且永遠拿不到 `WebPort`。

Process 內沒有 conversational state。Kind-to-service map 只保存 implementation；所有 mutable
state 都是 durable：

| State                                | 儲存位置                                       |
| ------------------------------------ | ---------------------------------------------- |
| Transcript                           | `agent.session_entry`                          |
| Draft                                | `agent.writing_session`、`agent.writing_draft` |
| Memory                               | `agent.memory`，索引進 `resource_chunk`        |
| Approval decisions                   | `agent.tool_approval`                          |
| Run metadata                         | `agent.run`                                    |
| Message inbox、pauses、event streams | workflow backend                               |

## 11. 新增另一個 agent kind

新的 domain kind 共用相同 concrete Pi runtime：

1. 新增 `@chia/agent-<kind>`，包含 tools、prompts、skills、policy、model allowlist 與 domain ports——
   會讀部落格的 kind 從 `@chia/agent-content` 組合 `contentReadTools`，tool context 繼承
   `ContentToolContext`；
2. 需要 kind-specific persistence 時新增 extension table；
3. 在 `apps/service/src/agents/` 新增它的 `AgentKindDefinition`——含它允許的 `minTier`、
   `label`/`description` 與 operator `config` schema——並在 service factory 加上它的 binding
   （`minTier` + loader）；workflow factory 也加入 execution-bound sibling 與 switch branch；
4. 讓它的 `runTurn` 呼叫新 domain 的 `run<Kind>Turn`，自己的 task definition 加到
   `AGENT_TASKS`（§13）；
5. 共用 `runPiTurn`、wire events、approval semantics 與 durable stream plumbing。

在真正出現第二種 execution foundation 且差異已知以前，不新增 engine adapter、engine
factory、capability plugin system 或 provider-neutral handle。

## 12. 參考位置

| Concern                      | File                                                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Pi turn lifecycle            | `packages/agent-runtime/src/pi/turn.ts`                                                                              |
| Pi approval hook             | `packages/agent-runtime/src/pi/tool-gate.ts`                                                                         |
| Turn budget                  | `packages/agent-runtime/src/pi/turn-budget.ts`                                                                       |
| Error classification         | `packages/agent-runtime/src/pi/errors.ts`                                                                            |
| Details clipping             | `packages/agent-runtime/src/wire/clip.ts`                                                                            |
| Abort controller             | `apps/workflow/src/workflows/agent-abort.workflow.ts`, `packages/api/orpc/services/agent/abort.ts`                  |
| Compaction / maintenance     | `packages/agent-runtime/src/pi/compaction.ts`、`pi/maintenance.ts`                                                   |
| Wire schema / fold / replay  | `packages/agent-runtime/src/wire/`                                                                                   |
| Live Pi event mapping        | `packages/agent-runtime/src/pi/events.ts`                                                                            |
| Models/providers             | `packages/agent-runtime/src/models.ts`                                                                               |
| Session tree contract        | `packages/agent-runtime/src/session/tree.ts`, `session/entries.ts`                                                   |
| Branch projection            | `packages/agent-runtime/src/session/context.ts`                                                                      |
| Session over Postgres        | `packages/agent-runtime/src/session/pg-storage.ts`, `session/pg-repo.ts`                                             |
| Tool-authoring helpers       | `packages/agent-runtime/src/tools.ts`                                                                                |
| Content read tools / port    | `packages/agent-content/src/`、`packages/api/agents/content-read.port.ts`                               |
| Memory tools / port          | `packages/agent-writing/src/tools/memory.tool.ts`、`apps/workflow/src/services/agent-memory.port.ts`                 |
| Memory 寫入 / 索引           | `packages/api/memories/write.ts`、`apps/service/src/services/agent-memory-indexing.service.ts`                       |
| Writing composition          | `packages/agent-writing/src/runtime.ts`                                                                              |
| Writing tools/prompts/policy | `packages/agent-writing/src/tools/`、`src/prompts/`、`src/policy.ts`                                                 |
| Public composition           | `packages/agent-public/src/runtime.ts`、`src/models.ts`、`src/policy.ts`、`src/prompts/system.ts`                    |
| Agent factory / service      | `packages/api/orpc/services/agent.factory.ts`、`services/agent/`、`packages/agent-host/src/kind.ts`                 |
| Writing kind binding         | `packages/agent-host/src/writing.ts`, `apps/service/src/agents/writing.ts`, `apps/workflow/src/agents/writing.ts`    |
| Public kind binding          | `packages/agent-host/src/public.ts`、`apps/service/src/agents/public.ts`、`apps/workflow/src/agents/public.ts`       |
| Task definitions / resolution | `packages/agent-host/src/tasks.ts`                                                                                  |
| Operator configuration       | `packages/agent-host/src/config.ts`、`packages/api/orpc/services/agent/admin.ts`、`packages/db/src/libs/agent/config.ts` |
| Admin contract / service     | `packages/api/orpc/contracts/agent-admin.contract.ts`、`packages/api/orpc/services/agent/admin.ts`                  |
| Durable workflow / step      | `apps/workflow/src/workflows/agent-session.workflow.ts`、`src/steps/agent-turn.step.ts`                              |
| Durable message inbox        | `packages/workflow-control/src/agent.hooks.ts`                                                                       |
| oRPC contract/routes         | `packages/api/orpc/contracts/agent.contract.ts`、`routes/agent.route.ts`                                             |
| Database schema              | `packages/db/src/schemas/agent.schema.ts`                                                                            |
| Client store 與 elements     | `packages/agent-elements/src/store.ts`, `src/*.tsx`                                                                  |
| Dashboard UI                 | `apps/dash/src/components/agent/`, `components/agents/` (kind and task configuration)                                |

## 13. Kind、task 與 operator 設定

兩個 code-defined source 都可以由 operator 在 dash 的 agent 工作區覆寫（`agent.admin.*`，
admin-only）：

| Source        | 位置                                      | 一個 entry 是                                                                         | Row                 |
| ------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- | ------------------- |
| agent factory | `apps/service/src/agents/factory.ts`      | 一個對話型 agent——tools、ports、policy、state row、`runTurn`                          | `agent.kind_config` |
| `AGENT_TASKS` | `packages/agent-host/src/tasks.ts`        | 一個在 session 旁邊跑的一次性模型呼叫——title、compaction、branch summary、lesson 抽取 | `agent.task_config` |

第三個 row 不是 registry：`agent.quota_config` 放 operator 對每週額度、其時區與執行中 turn
上限的覆寫（`agent.admin.quota.*`，workspace 的「Usage quota」卡片）；程式預設是
`packages/agent-host/src/quota.ts` 的 `AGENT_QUOTA_DEFAULTS`（§3）。

**Task** 是一個 model slot，加上呼叫有暴露時的 system prompt 與 sampling 參數。它們怎麼跑各不相同
（`completeSimple`、Pi 的 `compact()`、`generateBranchSummary`），這部分留在呼叫端；operator 要選的
東西則完全一樣，`resolveAgentTask` 是 definition 與 row 唯一交會的地方。Definition 的
`defaultModel` 是 house gateway 的 ref，或 `"session"`——task 跑在它服務的 session 的模型上。釘住的
模型永遠是 house gateway 的模型、以不帶 credentials 的 collection 解析：side job 從來不是 operator
自己的帳單，而 lesson 抽取跑在一個完全沒有 caller credentials 的 workflow 裡。釘住的模型若已不在
catalogue 裡，退回預設並留下 warning，讓 pi-ai 升級退化的是 task 而不是它旁邊的 turn。預設為
`"session"` 的 task 以 thunk 拿到 session 的模型、只在真的沿用時才解析，所以 BYOK session 的
compaction 可以釘到 house model、不帶 key 也能跑。

**Kind** 的 row 存新 session 建立時的 defaults（`providerId`/`modelId` 成對、`thinkingLevel`、
`autoApprove`）和一個由 kind 自己的 zod schema 定形的 `config` 物件（`AgentKindDefinition.config`）。
Defaults 在建立時複製到 session row 上，所以改了不會動到既有 session；`config` 由 turn step 每個
turn 讀一次（`loadKindConfig`），所以一次編輯會到達每個 session 的下一個 turn。Schema 以 JSON Schema
送給 dash，新增欄位是 schema 的變更、不是 contract 的變更。只放偏好：tool tier、approval policy、
turn budget 與 model allowlist 是安全邊界，留在 code。Writing 的 config 是 `instructions`——接在
system prompt 尾端的「Operator instructions」，屬於 stable prefix，改動時讓 provider 的 cached
prefix 失效一次、之後再次被 cache。

每一筆 admin 寫入落地前都先對它覆寫的 definition 驗證：kind 的模型過 kind 的 `models.assert`、
`autoApprove` 對照它的 tools 實際使用的 tier、`config` 過它的 schema；task 的模型對照 house
catalogue，prompt 與參數只在 task 有暴露時才能寫。因此一個 row 只能把 code 已允許的東西重新指向。
每個 view 都帶 `code`/`default`、`override`、`effective` 三層，dash 可以顯示值、標示是否被覆寫、
提供重設，而不必在 client 端重述解析規則。
