import { contentText } from "@earendil-works/pi-ai";
import type { Api, Model, Models } from "@earendil-works/pi-ai";

import type { AgentModelUsage } from "../types.ts";

/**
 * One-shot text completion for side jobs — a session title, a lesson extraction — that ride
 * alongside real work and must never fail it. Every failure path resolves `null`: provider
 * error, abort, an empty reply. The caller decides what "nothing" means.
 */

export interface CompleteTextOptions {
  /** Only the one-shot call is needed; a credential-free `createAgentModels()` satisfies this. */
  models: Pick<Models, "completeSimple">;
  model: Model<Api>;
  systemPrompt: string;
  /** The user turn. */
  text: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  /** What the call was billed, whatever it replied; an aborted stream is still charged for. */
  onUsage?: (usage: AgentModelUsage) => void | Promise<void>;
}

export const completeText = async ({
  models,
  model,
  systemPrompt,
  text,
  maxTokens = 1024,
  temperature = 0.2,
  signal,
  onUsage,
}: CompleteTextOptions): Promise<string | null> => {
  try {
    const reply = await models.completeSimple(
      model,
      {
        systemPrompt,
        messages: [{ role: "user", content: text, timestamp: Date.now() }],
      },
      { maxTokens, temperature, signal }
    );
    await onUsage?.({
      providerId: reply.provider,
      modelId: reply.model,
      usage: reply.usage,
    });
    if (reply.stopReason === "error" || reply.stopReason === "aborted") {
      return null;
    }
    const out = contentText(reply.content).trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
};
