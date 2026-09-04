import type { Api, Model, Models } from "@earendil-works/pi-ai";

import {
  AGENT_PROVIDERS,
  createAgentCatalog,
  createAgentModels,
  houseModel,
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
 * Public-agent model policy. The house pays for every gateway call a visitor makes, so the
 * gateway is a closed list of cheap ids, not a vendor prefix: `claude-sonnet-5` shares a
 * prefix with `claude-haiku-4.5`. Native providers are open: a visitor with their own key is
 * paying, and the quota does not count it.
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

export const DEFAULT_PUBLIC_MODEL: AgentModelRef = houseModel("public");

/**
 * Resolves a session's model. Defaults to a credential-free collection, so a BYOK pair with
 * no key fails as `UnknownAgentModelError` instead of billing the house account.
 */
export const resolvePublicModel = (
  ref: AgentModelRef,
  models: Models = createAgentModels()
): Model<Api> => resolveModel(ref, isPublicModel, models);

/**
 * Validates a selection against the catalogue, not a credential-bearing collection, so
 * whether a model exists never depends on which keys the caller registered.
 */
export const assertPublicModel = (ref: AgentModelRef): void => {
  resolveModel(ref, isPublicModel, createAgentCatalog());
};

export const listPublicModels = (
  options?: ListModelsOptions
): AgentModelInfo[] => listModels(isPublicModel, options);

export const PUBLIC_SESSION_DEFAULTS: AgentSessionDefaults = {
  providerId: DEFAULT_PUBLIC_MODEL.providerId,
  modelId: DEFAULT_PUBLIC_MODEL.modelId,
  thinkingLevel: "off",
};

export const PUBLIC_AGENT_KIND = "public";
