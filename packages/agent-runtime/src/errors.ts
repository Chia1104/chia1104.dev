import { messageOf } from "@chia/utils/error-helper";

import { AgentErrorKind } from "./types.ts";
import type { AgentTurnError } from "./types.ts";

/**
 * Maps a provider's failure text onto one {@link AgentTurnError}. The engine reports a provider
 * failure as a message, not a status, so the text is all there is to classify.
 * Context overflow is tested first: its 400 would otherwise read as a provider error. Quota is
 * tested before rate limiting: an OpenAI quota message is a 429 too.
 */

const CONTEXT_OVERFLOW =
  /context.?(length|window)|maximum context|prompt is too long|too many (input )?tokens|input (is )?too long|exceeds? the (model'?s? )?(context|token limit)/i;
const QUOTA =
  /insufficient_quota|quota exceeded|out of budget|billing|usage limit|credit/i;
const AUTH =
  /\b40[13]\b|invalid.?api.?key|incorrect api key|invalid x-api-key|authentication|unauthori[sz]ed|permission.?denied/i;
const RATE_LIMITED =
  /\b429\b|rate.?limit|too many requests|overloaded|resource.?exhausted/i;

export const errorOfProviderMessage = (message: string): AgentTurnError => {
  if (CONTEXT_OVERFLOW.test(message)) {
    return { kind: AgentErrorKind.ContextOverflow, message };
  }
  if (QUOTA.test(message)) return { kind: AgentErrorKind.Quota, message };
  if (AUTH.test(message)) return { kind: AgentErrorKind.Auth, message };
  if (RATE_LIMITED.test(message)) {
    return { kind: AgentErrorKind.RateLimited, message };
  }
  return { kind: AgentErrorKind.Provider, message };
};

/** Classifies an error thrown by a hook, a tool gate or turn persistence. */
export const errorOfThrown = (cause: unknown): AgentTurnError => ({
  kind: AgentErrorKind.Internal,
  message: messageOf(cause),
});
