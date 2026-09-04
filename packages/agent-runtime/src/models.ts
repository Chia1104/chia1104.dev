import { createModels, InMemoryModelsStore } from "@earendil-works/pi-ai";
import type {
  Api,
  Credential,
  CredentialInfo,
  CredentialStore,
  Model,
  Models,
} from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import { vercelAIGatewayProvider } from "@earendil-works/pi-ai/providers/vercel-ai-gateway";

import { HOUSE_MODELS } from "@chia/ai/house-models";
import type { HouseModelRole } from "@chia/ai/house-models";
import { GATEWAY_KEY_ID, PROVIDER_IDS, ProviderId } from "@chia/ai/provider";
import type { KeyId } from "@chia/ai/provider";

/**
 * Three providers, each its own wire and its own bill:
 *
 * - `vercel-ai-gateway`: reaches every vendor. Runs on the house key from the environment,
 *   or on a gateway key the caller brought, which pi-ai resolves ahead of the environment.
 *   Catalogue is not Anthropic-only: the gateway translates protocols server-side, so
 *   `openai/*` models are served over the same `anthropic-messages` API.
 * - `openai` / `anthropic`: the vendor's own API, registered only when the caller supplied
 *   that vendor's key. A registration-time decision rather than a resolve-time check: pi-ai's
 *   auth resolution falls back to ambient env vars when nothing is stored, and a process may
 *   carry `OPENAI_API_KEY` for reasons of its own.
 *
 * A model ref names the provider, so it also names the wire and who pays. Nothing is inferred.
 * `Models` is per-credential-set, not process-wide. See {@link createAgentModels}.
 */

export const AGENT_PROVIDERS = {
  gateway: "vercel-ai-gateway",
  openai: ProviderId.OpenAI,
  anthropic: ProviderId.Anthropic,
} as const;

/** Decrypted, request-scoped keys. Ciphertext is a transport concern; decrypted at the last moment. */
export type AgentCredentials = Partial<Record<KeyId, string>>;

/**
 * Which keys a caller holds, without the keys. What policy and listing see; a turn never
 * needs more than presence to decide who pays.
 */
export interface AgentModelAccess {
  /** The caller brought their own gateway key. */
  gateway: boolean;
  /** Vendors the caller brought a native key for. */
  native: readonly ProviderId[];
}

export const NO_ACCESS: AgentModelAccess = { gateway: false, native: [] };

/**
 * What an operator pinning a model for the house may reach: anything the gateway serves.
 * Never a caller's access; it would bill the house for their choice.
 */
export const HOUSE_ACCESS: AgentModelAccess = { gateway: true, native: [] };

/** Presence per key; ciphertext or plaintext, only presence is read. */
export const accessOf = (
  credentials: Partial<Record<KeyId, string>> | undefined
): AgentModelAccess => ({
  gateway: Boolean(credentials?.[GATEWAY_KEY_ID]),
  native: PROVIDER_IDS.filter((providerId) =>
    Boolean(credentials?.[providerId])
  ),
});

/** A resolved Pi model, as hosts that do not depend on pi-ai directly name it. */
export type AgentModel = Model<Api>;

/** Identifies a model. Both halves are required. See {@link resolveModel}. */
export interface AgentModelRef {
  providerId: string;
  modelId: string;
}

/** A kind's policy: whether it admits `ref` for a caller holding `access`. */
export type AgentModelPredicate = (
  ref: AgentModelRef,
  access: AgentModelAccess
) => boolean;

/** The house-billed ref for a role; every house model runs through the gateway. */
export const houseModel = (role: HouseModelRole): AgentModelRef => ({
  providerId: AGENT_PROVIDERS.gateway,
  modelId: HOUSE_MODELS[role],
});

export const sameModel = (a: AgentModelRef, b: AgentModelRef): boolean =>
  a.providerId === b.providerId && a.modelId === b.modelId;

/** Whether the caller holds a key that opens `providerId`; the gateway always has the house's. */
const holdsKeyFor = (providerId: string, access: AgentModelAccess): boolean =>
  providerId === AGENT_PROVIDERS.gateway ||
  /* SAFETY: `native` only ever holds ProviderId values; a foreign id simply fails the lookup. */ (
    access.native as readonly string[]
  ).includes(providerId);

/**
 * Read-only {@link CredentialStore} over a fixed set of keys, keyed by pi-ai provider id.
 * pi-ai's `InMemoryCredentialStore` requires awaiting `modify()` per provider, which would make
 * construction async. Nothing here is written: credentials arrived with the request and die
 * with it.
 */
const fixedCredentialStore = (
  credentials: AgentCredentials
): CredentialStore => {
  const entries = new Map<string, Credential>();
  for (const providerId of PROVIDER_IDS) {
    const key = credentials[providerId];
    if (key) entries.set(providerId, { type: "api_key", key });
  }
  if (credentials.gateway) {
    entries.set(AGENT_PROVIDERS.gateway, {
      type: "api_key",
      key: credentials.gateway,
    });
  }
  return {
    read: (providerId) => Promise.resolve(entries.get(providerId)),
    list: () =>
      Promise.resolve(
        [...entries.entries()].map(
          ([providerId, credential]): CredentialInfo => ({
            providerId,
            type: credential.type,
          })
        )
      ),
    modify: (providerId) => Promise.resolve(entries.get(providerId)),
    delete: () => Promise.resolve(),
  };
};

/**
 * Catalogues are static per pi-ai release and identical across callers, so this store is
 * process-wide even though `Models` instances are not.
 */
const modelsStore = new InMemoryModelsStore();

const nativeProvider = (providerId: ProviderId) =>
  providerId === ProviderId.OpenAI ? openaiProvider() : anthropicProvider();

/**
 * Builds the `Models` an agent turn executes against.
 * Called per turn: credentials are per request. Provider construction is cheap; static
 * catalogues, no I/O at registration.
 */
export const createAgentModels = (
  credentials: AgentCredentials = {}
): Models => {
  const models = createModels({
    modelsStore,
    credentials: fixedCredentialStore(credentials),
  });
  models.setProvider(vercelAIGatewayProvider());
  for (const providerId of PROVIDER_IDS) {
    if (credentials[providerId]) models.setProvider(nativeProvider(providerId));
  }
  return models;
};

/**
 * Every provider registered, no credentials.
 * Catalogue metadata is a property of the model, not of who is paying, so the picker can
 * describe a provider the caller has not authenticated yet.
 * Never use this to execute a turn; it would resolve native providers against ambient env keys.
 */
export const createAgentCatalog = (): Models => {
  const models = createModels({ modelsStore });
  models.setProvider(vercelAIGatewayProvider());
  for (const providerId of PROVIDER_IDS) {
    models.setProvider(nativeProvider(providerId));
  }
  return models;
};

export class UnknownAgentModelError extends Error {
  constructor(readonly ref: AgentModelRef) {
    super(
      `Model "${ref.modelId}" on provider "${ref.providerId}" is not available to this agent.`
    );
    this.name = "UnknownAgentModelError";
  }
}

/**
 * Resolves a `(providerId, modelId)` pair against a predicate owned by the agent kind.
 *
 * The pair is the identity, never the model id alone: the same model carries different ids
 * under different providers. `anthropic/claude-haiku-4.5` through the gateway is
 * `claude-haiku-4-5` natively.
 *
 * The predicate is policy: which models an agent may use for this caller. Pairs outside it
 * are rejected even when the provider would serve them, because the pair arrives from a
 * client-supplied setting.
 */
export const resolveModel = (
  ref: AgentModelRef,
  isAllowed: AgentModelPredicate,
  models: Models,
  access: AgentModelAccess
): Model<Api> => {
  if (!isAllowed(ref, access)) {
    throw new UnknownAgentModelError(ref);
  }
  const model = models.getModel(ref.providerId, ref.modelId);
  if (!model) {
    // Also the "native provider with no key" path: it was never registered, so it has no models.
    throw new UnknownAgentModelError(ref);
  }
  return model;
};

export interface AgentModelInfo {
  providerId: string;
  modelId: string;
  name: string;
  contextWindow: number;
  supportsReasoning: boolean;
  supportsImageInput: boolean;
  /** True when the caller cannot use this model until they register a key. */
  requiresApiKey: boolean;
}

export interface ListModelsOptions {
  access?: AgentModelAccess;
  /** Defaults to a full catalogue; pass a turn's `Models` only if you want its narrower view. */
  models?: Models;
}

/**
 * Enumerates each provider's catalogue and marks each model with whether the caller can use
 * it now. Refused models are listed rather than hidden: hiding them would leave no way to
 * discover that registering a key unlocks them.
 * Metadata is pi-ai's own, so context window and modality stay correct across pi-ai upgrades.
 */
export const listModels = (
  isAllowed: AgentModelPredicate,
  options: ListModelsOptions = {}
): AgentModelInfo[] => {
  const models = options.models ?? createAgentCatalog();
  const access = options.access ?? NO_ACCESS;
  return models.getProviders().flatMap((provider) =>
    provider.getModels().map((model) => {
      const ref = { providerId: provider.id, modelId: model.id };
      return {
        ...ref,
        name: model.name,
        contextWindow: model.contextWindow,
        supportsReasoning: Boolean(model.reasoning),
        supportsImageInput: model.input.includes("image"),
        requiresApiKey: !(
          isAllowed(ref, access) && holdsKeyFor(provider.id, access)
        ),
      };
    })
  );
};
