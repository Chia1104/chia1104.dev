import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

import {
  OPENAI_API_KEY,
  ANTHROPIC_API_KEY,
  GENAI_API_KEY,
} from "@chia/ai/constants";
import { Provider } from "@chia/ai/types";
import { verifyApiKey } from "@chia/ai/utils";
import { applyPolicy } from "@chia/service-kit/adapters/hono";
import { aiKeyPolicy, AI_AUTH_TOKEN } from "@chia/service-kit/policies";
import { tryCatch } from "@chia/utils/error-helper";
import { errorGenerator } from "@chia/utils/server";

import { env } from "../env";

export { AI_AUTH_TOKEN };

type AiContext = HonoContext<undefined, Variables & { AI_AUTH_TOKEN: string }>;

const cookieName = (provider?: Provider) => {
  switch (provider) {
    case Provider.OpenAI:
      return OPENAI_API_KEY;
    case Provider.Anthropic:
      return ANTHROPIC_API_KEY;
    case Provider.Google:
      return GENAI_API_KEY;
    default:
      return undefined;
  }
};

/**
 * Resolves the caller's provider API key from cookies into `c.var.AI_AUTH_TOKEN`.
 *
 * Which provider to look for is request-shaped — it can come from the JSON body — so it
 * is resolved here and handed to the shared `aiKeyPolicy` as an option. The policy
 * itself only ever reads the service context.
 */
export const ai = (
  provider?: Provider,
  enabled: (c: Context<AiContext>) => Promise<boolean> | boolean = () => true
) =>
  createMiddleware<AiContext>(async (c, next) => {
    if (!(await enabled(c))) {
      return next();
    }

    const privateKey = env.AI_AUTH_PRIVATE_KEY;

    if (!privateKey) {
      return c.json(errorGenerator(503), 503, {
        "Retry-After": "3600",
      });
    }

    const { data: json } = await tryCatch(
      c.req.json<{ model: { provider: Provider } }>()
    );

    const denied = await applyPolicy(
      c,
      aiKeyPolicy({
        cookieName: cookieName(provider ?? json?.model?.provider),
        verify: (encoded) => verifyApiKey(encoded, privateKey),
      })
    );

    if (denied) {
      return denied;
    }

    await next();
  });
