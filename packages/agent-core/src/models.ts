import { createModels } from "@earendil-works/pi-ai";
import type { Api, Model, Models } from "@earendil-works/pi-ai";
import { vercelAIGatewayProvider } from "@earendil-works/pi-ai/providers/vercel-ai-gateway";

/**
 * Model layer.
 *
 * pi-ai ships a first-class `vercelAIGatewayProvider()` that talks Anthropic's native
 * messages API against `https://ai-gateway.vercel.sh` and resolves its key from
 * `AI_GATEWAY_API_KEY` — the same gateway and the same env var the rest of the repo
 * already uses. So there is no custom provider to write, and native thinking / prompt
 * caching fidelity is preserved (an OpenAI-compatible shim would have lost both).
 */

export const AGENT_PROVIDER_ID = "vercel-ai-gateway";

/**
 * Provider registration is process-wide and immutable, so it is built once and cached.
 * `Models` holds no per-request state — auth resolves per call.
 */
let cached: Models | undefined;

export const getAgentModels = (): Models => {
  if (!cached) {
    const models = createModels();
    models.setProvider(vercelAIGatewayProvider());
    cached = models;
  }
  return cached;
};

export class UnknownAgentModelError extends Error {
  constructor(
    readonly modelId: string,
    allowlist: readonly string[]
  ) {
    super(
      `Model "${modelId}" is not available to this agent. Allowed: ${allowlist.join(", ")}`
    );
    this.name = "UnknownAgentModelError";
  }
}

/**
 * Resolves a model against an **allowlist owned by the agent kind**.
 *
 * The allowlist is a parameter rather than a constant here: which models an agent may use is
 * policy, and a long-horizon authoring agent with write access wants a different (narrower) set
 * than, say, a public Q&A agent. Ids outside it are rejected even when the gateway would serve
 * them, because the id arrives from a client-supplied setting.
 */
export const resolveModel = (
  modelId: string,
  allowlist: readonly string[],
  models: Models = getAgentModels()
): Model<Api> => {
  if (!allowlist.includes(modelId)) {
    throw new UnknownAgentModelError(modelId, allowlist);
  }
  const model = models.getModel(AGENT_PROVIDER_ID, modelId);
  if (!model) {
    throw new UnknownAgentModelError(modelId, allowlist);
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
}

/** Model picker payload. Silently skips ids the installed pi-ai catalogue lacks. */
export const listModels = (
  allowlist: readonly string[],
  models: Models = getAgentModels()
): AgentModelInfo[] =>
  allowlist.flatMap((modelId) => {
    const model = models.getModel(AGENT_PROVIDER_ID, modelId);
    if (!model) return [];
    return [
      {
        providerId: AGENT_PROVIDER_ID,
        modelId,
        name: model.name,
        contextWindow: model.contextWindow,
        supportsReasoning: Boolean(model.reasoning),
        supportsImageInput: model.input.includes("image"),
      },
    ];
  });
