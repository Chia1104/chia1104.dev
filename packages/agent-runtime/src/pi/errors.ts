import type { AssistantMessage } from "@earendil-works/pi-ai";
import { isContextOverflow } from "@earendil-works/pi-ai";

import type { AgentErrorKind, AgentTurnError } from "../types.ts";

/**
 * Maps Pi's failure surface onto one {@link AgentTurnError}.
 * Pi reports a thrown harness error, or an assistant message with `stopReason: "error"`.
 * Quota is tested before rate limiting: an OpenAI quota message is a 429 too.
 */

const QUOTA =
  /insufficient_quota|quota exceeded|out of budget|billing|usage limit|credit/i;
const AUTH =
  /\b40[13]\b|invalid.?api.?key|incorrect api key|invalid x-api-key|authentication|unauthori[sz]ed|permission.?denied/i;
const RATE_LIMITED =
  /\b429\b|rate.?limit|too many requests|overloaded|resource.?exhausted/i;

const kindOfMessage = (message: string): AgentErrorKind => {
  if (QUOTA.test(message)) return "quota";
  if (AUTH.test(message)) return "auth";
  if (RATE_LIMITED.test(message)) return "rate_limited";
  return "provider";
};

/** Classifies an assistant message that ended with `stopReason: "error"`. */
export const errorOfAssistantMessage = (
  message: AssistantMessage,
  contextWindow?: number
): AgentTurnError => {
  const text = message.errorMessage ?? "The provider returned an error.";
  if (isContextOverflow(message, contextWindow)) {
    return { kind: "context_overflow", message: text };
  }
  return { kind: kindOfMessage(text), message: text };
};

/** Classifies an error thrown by the harness, a hook, or turn persistence. */
export const errorOfThrown = (cause: unknown): AgentTurnError => ({
  kind: "internal",
  message: cause instanceof Error ? cause.message : String(cause),
});
