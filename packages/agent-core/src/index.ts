/**
 * `@chia/agent-core` — the agent runtime substrate, with no idea what any agent is *for*.
 *
 * **Every import of `@earendil-works/pi-*` in this repo lives in this package.** pi is pre-1.0 and
 * moves fast (0.81 → 0.82 removed `AgentHarnessOptions.env` and introduced the `toolContext`
 * generic), so versions are pinned exactly and the churn is contained: a pi upgrade means type
 * errors in one package, not across the monorepo.
 *
 * What is generic and lives here:
 * - `session` — the session tree over Postgres (pi's `SessionStorage`/`SessionRepo` ports) and the
 *   steering queue. Discriminated by `agent_session.kind`.
 * - `models` — pi-ai provider registration. The per-kind model allowlist is a *parameter*.
 * - `events` — the wire contract and the fold shared by server and client. `tier` is a plain string
 *   because tiers are per-kind policy.
 * - `permissions` — the approval gate, with classification injected via `AgentPolicy`.
 * - `harness` — assembles tools, prompt, skills and policy into a per-turn `AgentHarness`.
 *
 * What does **not** belong here: tools, prompts, domain ports, staging buffers, tier unions. Those
 * are a kind's own — see `@chia/agent-writing`.
 */

export * from "./types.ts";
export * from "./ports.ts";
export {
  AGENT_PROVIDER_ID,
  UnknownAgentModelError,
  getAgentModels,
  listModels,
  resolveModel,
  type AgentModelInfo,
} from "./models.ts";
export {
  agentWireEventSchema,
  applyEvent,
  createEventMapper,
  emptyViewState,
  entriesToWireEvents,
  foldEvents,
  type AgentViewItem,
  type AgentViewState,
  type AgentWireEvent,
  type NoticeView,
  type TextMessageView,
  type ToolCallView,
} from "./events.ts";
export {
  createToolCallGate,
  type ApprovalRequest,
  type ToolCallGate,
} from "./permissions.ts";
export {
  createAgentHarness,
  type AgentHarnessHandle,
  type CreateAgentHarnessOptions,
} from "./harness.ts";
export {
  InMemoryPendingMessageStore,
  InMemorySessionRepo,
  InMemorySessionStorage,
  PgPendingMessageStore,
  PgSessionRepo,
  PgSessionStorage,
  Session,
  readSessionSettings,
  toPgSession,
  uuidv7,
  writeSessionSettings,
  type PgSessionCreateOptions,
  type PgSessionListOptions,
  type PgSessionMetadata,
  type SessionTreeEntry,
} from "./session/index.ts";
