import { AgentProvider } from "@chia/agent-runtime/models";
import type { AgentCatalog, AgentModel } from "@chia/agent-runtime/models";

import { DEFAULT_PUBLIC_MODEL } from "../src/models.ts";

/** A catalogue row with no prices; only identity and capabilities matter to policy. */
const catalogModel = (providerId: string, modelId: string): AgentModel => ({
  providerId,
  modelId,
  name: modelId,
  contextWindow: 200_000,
  reasoningEfforts: null,
  supportsTemperature: true,
  input: ["text"],
  pricing: { input: [], output: [], cacheRead: [], cacheWrite: [] },
});

/** The house model, two other gateway models, and both native providers. */
export const PUBLIC_CATALOG: AgentCatalog = {
  models: [
    catalogModel(AgentProvider.Gateway, DEFAULT_PUBLIC_MODEL.modelId),
    catalogModel(AgentProvider.Gateway, "anthropic/claude-sonnet-5"),
    catalogModel(AgentProvider.Gateway, "google/gemini-3.1-pro"),
    catalogModel(AgentProvider.OpenAI, "gpt-5.2"),
    catalogModel(AgentProvider.OpenAI, "gpt-5.4"),
    catalogModel(AgentProvider.Anthropic, "claude-sonnet-5"),
  ],
};
