import {
  ANTHROPIC_API_KEY,
  GENAI_API_KEY,
  OPENAI_API_KEY,
} from "@chia/ai/constants";
import { verifyApiKey } from "@chia/ai/utils";
import { runPolicy } from "@chia/service-kit/adapters/orpc";
import { aiKeyPolicy } from "@chia/service-kit/policies";

import { baseOS } from "../utils";

export type AiProvider = "openai" | "anthropic" | "google";

const COOKIE_BY_PROVIDER: Record<AiProvider, string> = {
  openai: OPENAI_API_KEY,
  anthropic: ANTHROPIC_API_KEY,
  google: GENAI_API_KEY,
};

export interface AiKeyGuardInput {
  /**
   * Whether the key is required for *this* call. Callers map it from the validated input
   * — e.g. `feeds.search` only needs a key for OpenAI-hosted embedding models.
   */
  enabled: boolean;
  provider?: AiProvider;
}

/**
 * Resolves the caller's provider API key from cookies into `context.AI_AUTH_TOKEN`.
 *
 * Whether a key is needed depends on the request's input, which a policy never sees, so
 * the decision is mapped in by the procedure via `.use(guard, mapInput)`.
 */
export const aiKeyGuard = (defaults?: { provider?: AiProvider }) =>
  baseOS
    .errors({
      UNAUTHORIZED: {},
      SERVICE_UNAVAILABLE: {},
    })
    .middleware(async ({ next, context, errors }, input: AiKeyGuardInput) => {
      if (!input.enabled) {
        return next({
          context: { AI_AUTH_TOKEN: undefined as string | undefined },
        });
      }

      const privateKey = context.config.aiAuthPrivateKey;

      if (!privateKey) {
        throw errors.SERVICE_UNAVAILABLE();
      }

      const provider = input.provider ?? defaults?.provider;

      const { AI_AUTH_TOKEN } = await runPolicy(
        aiKeyPolicy({
          cookieName: provider ? COOKIE_BY_PROVIDER[provider] : undefined,
          verify: (encoded) => verifyApiKey(encoded, privateKey),
        }),
        context
      );

      return next({
        context: { AI_AUTH_TOKEN: AI_AUTH_TOKEN as string | undefined },
      });
    });
