/**
 * `@chia/agent` — the writing agent for the admin dashboard.
 *
 * **Every import of `@earendil-works/pi-*` in this repo lives inside this package.** pi is
 * pre-1.0 and moves fast (0.81 → 0.82 removed `AgentHarnessOptions.env` and introduced the
 * `toolContext` generic), so versions are pinned exactly and the churn is contained here: a pi
 * upgrade means type errors in one package, not across the monorepo.
 *
 * Layering:
 * - `types` / `ports` — what the package needs from the host app.
 * - `models` — pi-ai provider registration (Vercel AI Gateway).
 * - `session` / `draft` — persistence over `@chia/db`.
 * - `tools` — the three tool tiers.
 * - `prompts` — system prompt, skills, slash-command templates.
 * - `permissions` — the tier-3 approval gate.
 * - `harness` — assembles all of the above into a per-turn `AgentHarness`.
 * - `events` — the wire contract plus the fold shared by server and client.
 */

export * from "./types.ts";
export * from "./ports.ts";
export {
  AGENT_PROVIDER_ID,
  DEFAULT_WRITING_MODEL_ID,
  WRITING_MODEL_IDS,
  UnknownAgentModelError,
  getAgentModels,
  isWritingModelId,
  listWritingModels,
  resolveModel,
  type WritingModelId,
  type WritingModelInfo,
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
  tierOf,
  type ApprovalRequest,
  type ToolCallGate,
} from "./permissions.ts";
export {
  createWritingHarness,
  type CreateWritingHarnessOptions,
  type WritingHarness,
} from "./harness.ts";
export {
  TOOL_NAMES,
  TOOL_LABEL_BY_NAME,
  TOOL_TIER_BY_NAME,
  createWritingTools,
  labelOf,
  readOnlyToolNames,
  summarizeToolResult,
  type ToolName,
  type ValidationIssue,
} from "./tools/index.ts";
export {
  buildSystemPrompt,
  writingPromptTemplates,
  writingSkills,
} from "./prompts/index.ts";
export {
  PgDraftStore,
  InMemoryDraftStore,
  applyEdit,
  emptyDraft,
  withLineNumbers,
  EditNotAppliedError,
} from "./draft/index.ts";
export {
  PgSessionRepo,
  PgSessionStorage,
  PgPendingMessageStore,
  InMemoryPendingMessageStore,
  readSessionSettings,
  writeSessionSettings,
  toPgSession,
  type PgSessionMetadata,
} from "./session/index.ts";
