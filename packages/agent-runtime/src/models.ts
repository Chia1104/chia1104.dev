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

/**
 * Pi model layer.
 *
 * Three providers, two credential stories:
 *
 * - `vercel-ai-gateway` — the house account. pi-ai's own provider talks Anthropic's native messages
 *   API against `https://ai-gateway.vercel.sh` and resolves `AI_GATEWAY_API_KEY` from the ambient
 *   environment, which is the same gateway and env var the rest of the repo already uses. Its
 *   catalogue is not Anthropic-only: the gateway translates protocols server-side, so `openai/*`
 *   models are served over the very same `anthropic-messages` API.
 * - `openai` / `anthropic` — bring-your-own-key. The caller's key arrives per request, so these are
 *   registered *only* when a credential is supplied. A registration-time decision rather than a
 *   resolve-time check, because pi-ai's auth resolution falls back to ambient env vars when nothing
 *   is stored — and `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` do exist in the service environment for
 *   unrelated features. Registering them unconditionally would silently bill the house account for
 *   what is meant to be the operator's own key.
 *
 * Consequently `Models` is **per-credential-set**, not process-wide. See {@link createAgentModels}.
 */

export const AGENT_PROVIDERS = {
  gateway: "vercel-ai-gateway",
  openai: "openai",
  anthropic: "anthropic",
} as const;

/** Providers whose key the caller supplies. The gateway is deliberately absent. */
export const BYOK_PROVIDER_IDS = [
  AGENT_PROVIDERS.openai,
  AGENT_PROVIDERS.anthropic,
] as const;

export type ByokProviderId = (typeof BYOK_PROVIDER_IDS)[number];

export const isByokProviderId = (
  providerId: string
): providerId is ByokProviderId =>
  /* SAFETY: The producer contract guarantees this value satisfies readonly string[]. */ (
    BYOK_PROVIDER_IDS as readonly string[]
  ).includes(providerId);

/**
 * Decrypted, request-scoped provider keys.
 *
 * Plaintext: the ciphertext form is a transport concern and is decrypted at the last possible
 * moment — see `apps/service/src/steps/agent-turn.step.ts`.
 */
export type AgentCredentials = Partial<Record<ByokProviderId, string>>;

/** A resolved Pi model, as hosts that do not depend on pi-ai directly name it. */
export type AgentModel = Model<Api>;

/** Identifies a model. Both halves are required — see {@link resolveModel}. */
export interface AgentModelRef {
  providerId: string;
  modelId: string;
}

/** Whether a kind's policy admits a model. See `@chia/agent-writing`'s `isWritingModel`. */
export type AgentModelPredicate = (ref: AgentModelRef) => boolean;

/**
 * Read-only {@link CredentialStore} over a fixed set of keys.
 *
 * pi-ai's own `InMemoryCredentialStore` would work, but seeding it means awaiting `modify()` per
 * provider, which would make model construction async for no gain. Nothing here is ever written:
 * login and logout are meaningless for credentials that arrived with the request and die with it.
 */
const fixedCredentialStore = (
  credentials: AgentCredentials
): CredentialStore => {
  const entries = new Map<string, Credential>(
    Object.entries(credentials).flatMap(([providerId, key]) =>
      key
        ? [
            [
              providerId,
              /* SAFETY: The producer contract guarantees this value satisfies Credential. */ {
                type: "api_key",
                key,
              } as Credential,
            ],
          ]
        : []
    )
  );
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
 * Model catalogues are static per pi-ai release and identical across callers, so the store that
 * backs them is shared process-wide even though `Models` instances are not.
 */
const modelsStore = new InMemoryModelsStore();

/**
 * Builds the `Models` an agent turn executes against.
 *
 * Called **per turn**, because the BYOK credentials it closes over are per request. Provider
 * construction is cheap — these three ship static catalogues and perform no I/O at registration.
 */
export const createAgentModels = (
  credentials: AgentCredentials = {}
): Models => {
  const models = createModels({
    modelsStore,
    credentials: fixedCredentialStore(credentials),
  });
  models.setProvider(vercelAIGatewayProvider());
  if (credentials.openai) models.setProvider(openaiProvider());
  if (credentials.anthropic) models.setProvider(anthropicProvider());
  return models;
};

/**
 * Every provider registered, no credentials.
 *
 * For the model picker only: catalogue metadata (name, context window, cost) is a property of the
 * model, not of who is paying for it, so the picker can describe a provider the caller has not
 * authenticated yet — that is exactly what lets the UI say "needs an API key" instead of hiding it.
 * Never use this to execute a turn; it would resolve BYOK providers against ambient env keys.
 */
export const createAgentCatalog = (): Models => {
  const models = createModels({ modelsStore });
  models.setProvider(vercelAIGatewayProvider());
  models.setProvider(openaiProvider());
  models.setProvider(anthropicProvider());
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
 * Resolves a `(providerId, modelId)` pair against a predicate **owned by the agent kind**.
 *
 * The pair is the identity, never the model id alone: the same model carries different ids under
 * different providers — `anthropic/claude-haiku-4.5` through the gateway is `claude-haiku-4-5`
 * natively. Matching on the id alone would resolve a session to the wrong provider, or to nothing.
 *
 * The predicate is a parameter rather than a constant because which models an agent may use is
 * policy: a long-horizon authoring agent with write access wants a different set than a public Q&A
 * agent. Pairs outside it are rejected even when the provider would serve them, because the pair
 * arrives from a client-supplied setting.
 */
export const resolveModel = (
  ref: AgentModelRef,
  isAllowed: AgentModelPredicate,
  models: Models
): Model<Api> => {
  if (!isAllowed(ref)) {
    throw new UnknownAgentModelError(ref);
  }
  const model = models.getModel(ref.providerId, ref.modelId);
  if (!model) {
    // Also the "BYOK provider with no key" path: it was never registered, so it has no models.
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
  /** True when this provider needs a caller-supplied key that is not configured yet. */
  requiresApiKey: boolean;
}

export interface ListModelsOptions {
  /** Defaults to a full catalogue; pass a turn's `Models` only if you want its narrower view. */
  models?: Models;
  /** BYOK providers the caller has already authenticated. */
  configured?: readonly string[];
}

/**
 * Model picker payload.
 *
 * Enumerates each provider's catalogue and filters it through the kind's policy, rather than
 * looking up a hand-written list of ids. The metadata is pi-ai's own, so a model's context window
 * and modality stay correct across pi-ai upgrades without anyone editing a constant.
 */
export const listModels = (
  isAllowed: AgentModelPredicate,
  options: ListModelsOptions = {}
): AgentModelInfo[] => {
  const models = options.models ?? createAgentCatalog();
  const configured = new Set(options.configured ?? []);
  return models.getProviders().flatMap((provider) =>
    provider.getModels().flatMap((model) => {
      const ref = { providerId: provider.id, modelId: model.id };
      if (!isAllowed(ref)) return [];
      return [
        {
          ...ref,
          name: model.name,
          contextWindow: model.contextWindow,
          supportsReasoning: Boolean(model.reasoning),
          supportsImageInput: model.input.includes("image"),
          requiresApiKey:
            isByokProviderId(provider.id) && !configured.has(provider.id),
        },
      ];
    })
  );
};
