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
 * Writing-agent model policy. Gateway is limited to the two vendors the tools were built
 * against; a native provider admits any of its ids because the caller is paying.
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
 * Resolves a session's model. Defaults to a credential-free collection (gateway only), so a
 * missing BYOK key fails as `UnknownAgentModelError` instead of billing the house account.
 */
export const resolveWritingModel = (
  ref: AgentModelRef,
  models: Models = createAgentModels()
): Model<Api> => resolveModel(ref, isWritingModel, models);

/**
 * Validates a selection against the catalogue, not a credential-bearing collection.
 * `isWritingModel` admits any native id, so a typo would persist and then fail inside the workflow
 * step.
 */
export const assertWritingModel = (ref: AgentModelRef): void => {
  resolveModel(ref, isWritingModel, createAgentCatalog());
};

export const listWritingModels = (
  options?: ListModelsOptions
): AgentModelInfo[] => listModels(isWritingModel, options);

export const WRITING_SESSION_DEFAULTS: AgentSessionDefaults = {
  providerId: DEFAULT_WRITING_MODEL.providerId,
  modelId: DEFAULT_WRITING_MODEL.modelId,
  thinkingLevel: "off",
};

export const WRITING_AGENT_KIND = "writing";
