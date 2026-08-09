/**
 * `@chia/agent-core` — shared agent data, policy and persistence primitives.
 *
 * Engine contracts, turn execution and provider adapters live in `@chia/agent-runtime`.
 *
 * What is generic and lives here:
 * - `session` — the session tree over Postgres (pi's `SessionStorage`/`SessionRepo` ports) and the
 *   steering queue. Discriminated by `agent_session.kind`.
 * - `models` — pi-ai provider registration. The per-kind model allowlist is a *parameter*.
 * - `events` — the wire contract and the fold shared by server and client. `tier` is a plain string
 *   because tiers are per-kind policy.
 * - `permissions` — the approval gate, with classification injected via `AgentPolicy`.
 *
 * What does **not** belong here: tools, prompts, domain ports, staging buffers, tier unions. Those
 * are a kind's own — see `@chia/agent-writing`.
 */

export * from "./types.ts";
export * from "./ports.ts";
export {
  AGENT_PROVIDERS,
  BYOK_PROVIDER_IDS,
  UnknownAgentModelError,
  createAgentCatalog,
  createAgentModels,
  isByokProviderId,
  listModels,
  resolveModel,
  type AgentCredentials,
  type AgentModelInfo,
  type AgentModelPredicate,
  type AgentModelRef,
  type ByokProviderId,
  type ListModelsOptions,
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
