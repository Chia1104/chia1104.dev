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
 * Which models the *public* agent may use.
 *
 * The house account pays for every gateway call a visitor makes, and the weekly allowance is
 * small, so the gateway is narrowed to an explicit list of cheap models — ids, not a vendor
 * prefix like the writing agent's: the point is to keep a visitor off `claude-sonnet-5`, which
 * shares the vendor prefix with `claude-haiku-4.5`. All three are models the agent's tool
 * schemas have been exercised against; a cheap model that ignores tool schemas wastes the
 * allowance without answering.
 *
 * The native providers are open: a visitor who registered their own key is paying for the
 * call themselves, and the quota does not count it.
 */
export const HOUSE_PUBLIC_MODEL_IDS = new Set([
  "anthropic/claude-haiku-4.5",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
]);

export const isPublicModel = (ref: AgentModelRef): boolean => {
  switch (ref.providerId) {
    case AGENT_PROVIDERS.gateway:
      return HOUSE_PUBLIC_MODEL_IDS.has(ref.modelId);
    case AGENT_PROVIDERS.openai:
    case AGENT_PROVIDERS.anthropic:
      return true;
    default:
      return false;
  }
};

export const DEFAULT_PUBLIC_MODEL: AgentModelRef = {
  providerId: AGENT_PROVIDERS.gateway,
  modelId: "anthropic/claude-haiku-4.5",
};

/**
 * Resolves a session's model. `models` defaults to a credential-free collection, so a BYOK
 * pair with no key threaded through fails as `UnknownAgentModelError` rather than billing the
 * house account.
 */
export const resolvePublicModel = (
  ref: AgentModelRef,
  models: Models = createAgentModels()
): Model<Api> => resolveModel(ref, isPublicModel, models);

/**
 * Validates a selection without executing it — against the catalogue, not a credential-bearing
 * collection, so whether a model exists never depends on which keys the caller registered.
 */
export const assertPublicModel = (ref: AgentModelRef): void => {
  resolveModel(ref, isPublicModel, createAgentCatalog());
};

export const listPublicModels = (
  options?: ListModelsOptions
): AgentModelInfo[] => listModels(isPublicModel, options);

/** Defaults a new public session is created with. */
export const PUBLIC_SESSION_DEFAULTS: AgentSessionDefaults = {
  providerId: DEFAULT_PUBLIC_MODEL.providerId,
  modelId: DEFAULT_PUBLIC_MODEL.modelId,
  thinkingLevel: "off",
};

/** `agent.session.kind` for this agent. */
export const PUBLIC_AGENT_KIND = "public";
