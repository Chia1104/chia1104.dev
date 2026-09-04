import type { Api, Model, Models } from "@earendil-works/pi-ai";

import {
  AGENT_PROVIDERS,
  createAgentCatalog,
  createAgentModels,
  houseModel,
  listModels,
  NO_ACCESS,
  resolveModel,
  sameModel,
} from "@chia/agent-runtime/models";
import type {
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
      case AGENT_PROVIDERS.gateway:
        return access.gateway || sameModel(ref, house);
      case AGENT_PROVIDERS.openai:
      case AGENT_PROVIDERS.anthropic:
        return true;
      default:
        return false;
    }
  };

export const DEFAULT_PUBLIC_MODEL: AgentModelRef = houseModel("public");

/**
 * Resolves a session's model. Defaults to a credential-free collection, so a native pair with
 * no key fails as `UnknownAgentModelError` instead of billing the house account.
 */
export const resolvePublicModel = (
  ref: AgentModelRef,
  models: Models = createAgentModels(),
  access: AgentModelAccess = NO_ACCESS,
  house: AgentModelRef = DEFAULT_PUBLIC_MODEL
): Model<Api> => resolveModel(ref, publicModelPolicy(house), models, access);

/**
 * Validates a selection against the catalogue, not a credential-bearing collection, so
 * whether a model exists never depends on which keys the caller registered.
 */
export const assertPublicModel = (
  ref: AgentModelRef,
  access: AgentModelAccess,
  house: AgentModelRef
): void => {
  resolveModel(ref, publicModelPolicy(house), createAgentCatalog(), access);
};

export const listPublicModels = (
  access: AgentModelAccess,
  house: AgentModelRef
): AgentModelInfo[] => listModels(publicModelPolicy(house), { access });

export const PUBLIC_SESSION_DEFAULTS: AgentSessionDefaults = {
  providerId: DEFAULT_PUBLIC_MODEL.providerId,
  modelId: DEFAULT_PUBLIC_MODEL.modelId,
  thinkingLevel: "off",
};

export const PUBLIC_AGENT_KIND = "public";
