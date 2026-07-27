import type { Model, Models } from "@earendil-works/pi-ai";

import { AGENT_PROVIDER_ID, listModels, resolveModel } from "@chia/agent-core";
import type { AgentModelInfo, AgentSessionDefaults } from "@chia/agent-core";

/**
 * Which models the *writing* agent may use.
 *
 * Narrow on purpose: a long-horizon authoring agent with write access to the blog is a bad place to
 * discover that a cheap model ignores tool schemas. Ordered best-first — the head is the default.
 *
 * The allowlist lives here rather than in `@chia/agent-core` because it is policy, not
 * infrastructure. A public-facing agent would want a cheaper, faster set.
 */
export const WRITING_MODEL_IDS = [
  "anthropic/claude-sonnet-5",
  "anthropic/claude-opus-5",
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-haiku-4.5",
] as const;

export type WritingModelId = (typeof WRITING_MODEL_IDS)[number];

export const DEFAULT_WRITING_MODEL_ID: WritingModelId =
  "anthropic/claude-sonnet-5";

export const isWritingModelId = (modelId: string): modelId is WritingModelId =>
  (WRITING_MODEL_IDS as readonly string[]).includes(modelId);

export const resolveWritingModel = (
  modelId: string,
  models?: Models
): Model<any> => resolveModel(modelId, WRITING_MODEL_IDS, models);

export const listWritingModels = (models?: Models): AgentModelInfo[] =>
  listModels(WRITING_MODEL_IDS, models);

/** Defaults a new writing session is created with. */
export const WRITING_SESSION_DEFAULTS: AgentSessionDefaults = {
  providerId: AGENT_PROVIDER_ID,
  modelId: DEFAULT_WRITING_MODEL_ID,
  thinkingLevel: "off",
};

/** `agent_session.kind` for this agent. */
export const WRITING_AGENT_KIND = "writing";
