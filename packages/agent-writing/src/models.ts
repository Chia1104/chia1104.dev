import {
  AgentProvider,
  houseModel,
  listModels,
  resolveModel,
} from "@chia/agent-runtime/models";
import type {
  AgentCatalog,
  AgentModel,
  AgentModelAccess,
  AgentModelInfo,
  AgentModelPredicate,
  AgentModelRef,
} from "@chia/agent-runtime/models";
import type { AgentSessionDefaults } from "@chia/agent-runtime/types";
import { ProviderId } from "@chia/ai/provider";

/**
 * Writing-agent model policy. Gateway is limited to the two vendors the tools were built
 * against; a native provider admits any of its ids because the caller is paying.
 */
export const isWritingModel: AgentModelPredicate = (ref) => {
  switch (ref.providerId) {
    case AgentProvider.Gateway:
      return Object.values(ProviderId).some((vendor) =>
        ref.modelId.startsWith(`${vendor}/`)
      );
    case AgentProvider.OpenAI:
    case AgentProvider.Anthropic:
      return true;
    default:
      return false;
  }
};

export const DEFAULT_WRITING_MODEL: AgentModelRef = houseModel("writing");

/** Throws `UnknownAgentModelError` when the policy refuses the pair or the catalogue lacks it. */
export const resolveWritingModel = (
  ref: AgentModelRef,
  catalog: AgentCatalog,
  access: AgentModelAccess
): AgentModel => resolveModel(ref, isWritingModel, catalog, access);

/**
 * Validates a selection against the catalogue. `isWritingModel` admits any native id, so a typo
 * would otherwise persist and then fail inside the workflow step.
 */
export const assertWritingModel = (
  ref: AgentModelRef,
  catalog: AgentCatalog,
  access: AgentModelAccess
): void => {
  resolveWritingModel(ref, catalog, access);
};

export const listWritingModels = (
  catalog: AgentCatalog,
  access: AgentModelAccess
): AgentModelInfo[] => listModels(isWritingModel, catalog, access);

export const WRITING_SESSION_DEFAULTS: AgentSessionDefaults = {
  providerId: DEFAULT_WRITING_MODEL.providerId,
  modelId: DEFAULT_WRITING_MODEL.modelId,
  thinkingLevel: "off",
};

export const WRITING_AGENT_KIND = "writing";
