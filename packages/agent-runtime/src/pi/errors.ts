import type { AssistantMessage } from "@earendil-works/pi-ai";
import { isContextOverflow } from "@earendil-works/pi-ai";

import { messageOf } from "@chia/utils/error-helper";

import { AgentErrorKind } from "../types.ts";
import type { AgentTurnError } from "../types.ts";

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
  if (QUOTA.test(message)) return AgentErrorKind.Quota;
  if (AUTH.test(message)) return AgentErrorKind.Auth;
  if (RATE_LIMITED.test(message)) return AgentErrorKind.RateLimited;
  return AgentErrorKind.Provider;
};

/** Classifies an assistant message that ended with `stopReason: "error"`. */
export const errorOfAssistantMessage = (
  message: AssistantMessage,
  contextWindow?: number
): AgentTurnError => {
  const text = message.errorMessage ?? "The provider returned an error.";
  if (isContextOverflow(message, contextWindow)) {
    return { kind: AgentErrorKind.ContextOverflow, message: text };
  }
  return { kind: kindOfMessage(text), message: text };
};

/** Classifies an error thrown by the harness, a hook, or turn persistence. */
export const errorOfThrown = (cause: unknown): AgentTurnError => ({
  kind: AgentErrorKind.Internal,
  message: messageOf(cause),
});
