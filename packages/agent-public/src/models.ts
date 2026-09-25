import {
  AgentProvider,
  houseModel,
  listModels,
  resolveModel,
  sameModel,
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

/**
 * Public-agent model policy. The house pays for a gateway call made on its key, so without a
 * gateway key of their own a visitor gets exactly the model the operator pinned as the kind
 * default. A visitor who brought a gateway key may pick anything the gateway serves; native
 * providers are open because they only exist on the visitor's own key.
 */
export const publicModelPolicy =
  (house: AgentModelRef): AgentModelPredicate =>
  (ref, access) => {
    switch (ref.providerId) {
      case AgentProvider.Gateway:
        return access.gateway || sameModel(ref, house);
      case AgentProvider.OpenAI:
      case AgentProvider.Anthropic:
        return true;
      default:
        return false;
    }
  };

export const DEFAULT_PUBLIC_MODEL: AgentModelRef = houseModel("public");

/** Throws `UnknownAgentModelError` when the policy refuses the pair or the catalogue lacks it. */
export const resolvePublicModel = (
  ref: AgentModelRef,
  catalog: AgentCatalog,
  access: AgentModelAccess,
  house: AgentModelRef
): AgentModel => resolveModel(ref, publicModelPolicy(house), catalog, access);

export const assertPublicModel = (
  ref: AgentModelRef,
  catalog: AgentCatalog,
  access: AgentModelAccess,
  house: AgentModelRef
): void => {
  resolvePublicModel(ref, catalog, access, house);
};

export const listPublicModels = (
  catalog: AgentCatalog,
  access: AgentModelAccess,
  house: AgentModelRef
): AgentModelInfo[] => listModels(publicModelPolicy(house), catalog, access);

export const PUBLIC_SESSION_DEFAULTS: AgentSessionDefaults = {
  providerId: DEFAULT_PUBLIC_MODEL.providerId,
  modelId: DEFAULT_PUBLIC_MODEL.modelId,
  thinkingLevel: "off",
};

export const PUBLIC_AGENT_KIND = "public";
