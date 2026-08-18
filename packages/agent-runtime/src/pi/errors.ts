import type { AssistantMessage } from "@earendil-works/pi-ai";
import { isContextOverflow } from "@earendil-works/pi-ai";

import type { AgentErrorKind, AgentTurnError } from "../types.ts";

/**
 * Turns Pi's failure surface into one {@link AgentTurnError}.
 *
 * Pi reports provider failures two ways: a thrown harness/hook error, or a resolved assistant
 * message with `stopReason: "error"` and the provider's text in `errorMessage` (already
 * post-retry). Both end up here so the wire carries one vocabulary. Order matters: a quota
 * message from OpenAI is a 429 too, so quota is tested before rate limiting.
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
export const errorOfThrown = (error: unknown): AgentTurnError => ({
  kind: "internal",
  message: error instanceof Error ? error.message : String(error),
});
