/**
 * `@chia/agent-writing` — the blog authoring agent.
 *
 * The *domain* half of the agent: tools, prompts, the draft staging buffer, and the policy that
 * classifies and gates them. The turn loop and provider adapters live in `@chia/agent-runtime`;
 * session persistence, approval gates and wire events live in `@chia/agent-core`.
 *
 * Adding another agent kind means adding a sibling package like this one — not editing core.
 */

export * from "./types.ts";
export * from "./ports.ts";
export {
  DEFAULT_WRITING_MODEL,
  WRITING_AGENT_KIND,
  WRITING_SESSION_DEFAULTS,
  assertWritingModel,
  isWritingModel,
  listWritingModels,
  resolveWritingModel,
} from "./models.ts";
export { writingPolicy } from "./policy.ts";
export {
  createWritingEngine,
  createWritingMaintenanceEngine,
  writingAgentDefinition,
  writingAgentRuntime,
  type CreateWritingEngineOptions,
  type CreateWritingMaintenanceEngineOptions,
  type WritingEngine,
} from "./runtime.ts";
export {
  EditNotAppliedError,
  InMemoryDraftStore,
  PgDraftStore,
  applyEdit,
  emptyDraft,
  withLineNumbers,
} from "./draft/index.ts";
export {
  buildSystemPrompt,
  writingPromptTemplates,
  writingSkills,
} from "./prompts/index.ts";
export {
  TOOL_LABEL_BY_NAME,
  TOOL_NAMES,
  TOOL_TIER_BY_NAME,
  createWritingTools,
  labelOf,
  readOnlyToolNames,
  summarizeToolResult,
  type ToolName,
} from "./tools/index.ts";
