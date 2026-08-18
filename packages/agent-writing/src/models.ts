import type { Api, Model, Models } from "@earendil-works/pi-ai";

import {
  AGENT_PROVIDERS,
  createAgentCatalog,
  createAgentModels,
  listModels,
  resolveModel,
} from "@chia/agent-runtime/models";
import type {
  AgentModelInfo,
  AgentModelRef,
  ListModelsOptions,
} from "@chia/agent-runtime/models";
import type { AgentSessionDefaults } from "@chia/agent-runtime/types";

/**
 * Which models the *writing* agent may use.
 *
 * A predicate over `(providerId, modelId)` rather than a hand-written list of ids. Names, context
 * windows and costs all come from pi-ai's bundled catalogue, so they stay correct across pi-ai
 * upgrades without anyone editing a constant here — what this file owns is the *policy*, not the
 * data.
 *
 * The gateway carries 26 vendors' models, most never exercised against this agent's tool schemas. A
 * long-horizon authoring agent with write access to the blog is a bad place to discover that a
 * cheap model ignores them, so the gateway is narrowed to the two vendors the agent is actually
 * built against. The native providers need no such filter: a caller who supplied their own OpenAI
 * key is asking for OpenAI models.
 *
 * This lives here rather than in `@chia/agent-runtime` because it is domain policy. A
 * public-facing agent would want a cheaper, wider set.
 */
const GATEWAY_VENDOR_PREFIXES = ["anthropic/", "openai/"] as const;

export const isWritingModel = (ref: AgentModelRef): boolean => {
  switch (ref.providerId) {
    case AGENT_PROVIDERS.gateway:
      return GATEWAY_VENDOR_PREFIXES.some((prefix) =>
        ref.modelId.startsWith(prefix)
      );
    case AGENT_PROVIDERS.openai:
    case AGENT_PROVIDERS.anthropic:
      return true;
    default:
      return false;
  }
};

export const DEFAULT_WRITING_MODEL: AgentModelRef = {
  providerId: AGENT_PROVIDERS.gateway,
  modelId: "anthropic/claude-sonnet-5",
};

/**
 * Resolves a session's model.
 *
 * `models` defaults to a credential-free collection, which registers only the gateway — so a caller
 * that forgets to thread BYOK credentials through gets a clean `UnknownAgentModelError` naming the
 * provider, rather than a turn that silently bills the house account.
 */
export const resolveWritingModel = (
  ref: AgentModelRef,
  models: Models = createAgentModels()
): Model<Api> => resolveModel(ref, isWritingModel, models);

/**
 * Validates a selection without executing it. Throws `UnknownAgentModelError` if it fails.
 *
 * `isWritingModel` alone is not enough: it admits *any* id on a native provider, so a typo would
 * persist happily and then fail on every subsequent turn, deep inside the workflow step where the
 * operator cannot see why. Resolving against the full catalogue checks that the model exists at
 * all — the one thing policy cannot know.
 *
 * Deliberately the catalogue rather than a credential-bearing collection: whether a model *exists*
 * must not depend on which keys the caller happens to have registered, or the answer would change
 * between browsers.
 */
export const assertWritingModel = (ref: AgentModelRef): void => {
  resolveModel(ref, isWritingModel, createAgentCatalog());
};

export const listWritingModels = (
  options?: ListModelsOptions
): AgentModelInfo[] => listModels(isWritingModel, options);

/** Defaults a new writing session is created with. */
export const WRITING_SESSION_DEFAULTS: AgentSessionDefaults = {
  providerId: DEFAULT_WRITING_MODEL.providerId,
  modelId: DEFAULT_WRITING_MODEL.modelId,
  thinkingLevel: "off",
};

/** `agent_session.kind` for this agent. */
export const WRITING_AGENT_KIND = "writing";
