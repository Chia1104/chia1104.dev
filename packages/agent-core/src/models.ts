import { createModels } from "@earendil-works/pi-ai";
import type { Model, Models } from "@earendil-works/pi-ai";
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
 * Models offered to the writing agent, narrowed from the provider's ~192-model catalogue.
 *
 * Narrow on purpose: a long-horizon authoring agent with write access to the blog is a bad
 * place to discover that a cheap model ignores tool schemas. Ordered best-first — the head
 * is the default.
 */
export const WRITING_MODEL_IDS = [
  "anthropic/claude-sonnet-5",
  "anthropic/claude-opus-5",
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-haiku-4.5",
] as const;

export type WritingModelId = (typeof WRITING_MODEL_IDS)[number];

export const DEFAULT_WRITING_MODEL_ID: WritingModelId =
  "anthropic/claude-sonnet-5";

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
  constructor(readonly modelId: string) {
    super(
      `Model "${modelId}" is not available to the writing agent. Allowed: ${WRITING_MODEL_IDS.join(", ")}`
    );
    this.name = "UnknownAgentModelError";
  }
}

export const isWritingModelId = (modelId: string): modelId is WritingModelId =>
  (WRITING_MODEL_IDS as readonly string[]).includes(modelId);

/**
 * Resolves an allowlisted model id.
 *
 * Rejects ids outside {@link WRITING_MODEL_IDS} even when the gateway would serve them —
 * the model id reaches this function from a client-supplied setting.
 */
export const resolveModel = (
  modelId: string,
  models: Models = getAgentModels()
): Model<any> => {
  if (!isWritingModelId(modelId)) {
    throw new UnknownAgentModelError(modelId);
  }
  const model = models.getModel(AGENT_PROVIDER_ID, modelId);
  if (!model) {
    throw new UnknownAgentModelError(modelId);
  }
  return model;
};

export interface WritingModelInfo {
  providerId: string;
  modelId: string;
  name: string;
  contextWindow: number;
  supportsReasoning: boolean;
  supportsImageInput: boolean;
}

/** Model picker payload. Silently skips ids the installed pi-ai catalogue lacks. */
export const listWritingModels = (
  models: Models = getAgentModels()
): WritingModelInfo[] =>
  WRITING_MODEL_IDS.flatMap((modelId) => {
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
