import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

import { isProviderId, PROVIDER_COOKIE_NAMES } from "@chia/ai/provider";
import type { ProviderId } from "@chia/ai/provider";
import { verifyApiKey } from "@chia/ai/utils";
import { applyPolicy } from "@chia/service-kit/adapters/hono";
import {
  aiKeyPolicy,
  AI_AUTH_TOKEN,
} from "@chia/service-kit/policies/ai-key.policy";
import { tryCatch } from "@chia/utils/error-helper";
import { errorGenerator } from "@chia/utils/server";

import { env } from "../env";

export { AI_AUTH_TOKEN };

type AiContext = HonoContext<undefined, Variables & { AI_AUTH_TOKEN: string }>;

export const providerCookieName = (provider: ProviderId) =>
  PROVIDER_COOKIE_NAMES[provider];

/** Provider may come from the JSON body, so it is resolved here and passed into `aiKeyPolicy`. */
export const ai = (
  provider?: ProviderId,
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
      c.req.json<{ model?: { provider?: string } }>()
    );
    const bodyProvider = json?.model?.provider;
    const resolved =
      provider ??
      (bodyProvider && isProviderId(bodyProvider) ? bodyProvider : undefined);

    const denied = await applyPolicy(
      c,
      aiKeyPolicy({
        cookieName: resolved ? providerCookieName(resolved) : undefined,
        verify: (encoded) => verifyApiKey(encoded, privateKey),
      })
    );

    if (denied) {
      return denied;
    }

    await next();
  });
