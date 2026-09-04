import type { Api, Model, Models } from "@earendil-works/pi-ai";

import {
  AGENT_PROVIDERS,
  createAgentCatalog,
  createAgentModels,
  houseModel,
  listModels,
  NO_ACCESS,
  resolveModel,
} from "@chia/agent-runtime/models";
import type {
  AgentModelAccess,
  AgentModelInfo,
  AgentModelPredicate,
  AgentModelRef,
} from "@chia/agent-runtime/models";
import type { AgentSessionDefaults } from "@chia/agent-runtime/types";
import { PROVIDER_IDS } from "@chia/ai/provider";

/**
 * Writing-agent model policy. Gateway is limited to the two vendors the tools were built
 * against; a native provider admits any of its ids because the caller is paying.
 */
export const isWritingModel: AgentModelPredicate = (ref) => {
  switch (ref.providerId) {
    case AGENT_PROVIDERS.gateway:
      return PROVIDER_IDS.some((vendor) =>
        ref.modelId.startsWith(`${vendor}/`)
      );
    case AGENT_PROVIDERS.openai:
    case AGENT_PROVIDERS.anthropic:
      return true;
    default:
      return false;
  }
};

export const DEFAULT_WRITING_MODEL: AgentModelRef = houseModel("writing");

/**
 * Resolves a session's model. Defaults to a credential-free collection (gateway only), so a
 * missing native key fails as `UnknownAgentModelError` instead of billing the house account.
 */
export const resolveWritingModel = (
  ref: AgentModelRef,
  models: Models = createAgentModels(),
  access: AgentModelAccess = NO_ACCESS
): Model<Api> => resolveModel(ref, isWritingModel, models, access);

/**
 * Validates a selection against the catalogue, not a credential-bearing collection.
 * `isWritingModel` admits any native id, so a typo would persist and then fail inside the
 * workflow step.
 */
export const assertWritingModel = (
  ref: AgentModelRef,
  access: AgentModelAccess
): void => {
  resolveModel(ref, isWritingModel, createAgentCatalog(), access);
};

export const listWritingModels = (access: AgentModelAccess): AgentModelInfo[] =>
  listModels(isWritingModel, { access });

export const WRITING_SESSION_DEFAULTS: AgentSessionDefaults = {
  providerId: DEFAULT_WRITING_MODEL.providerId,
  modelId: DEFAULT_WRITING_MODEL.modelId,
  thinkingLevel: "off",
};

export const WRITING_AGENT_KIND = "writing";
