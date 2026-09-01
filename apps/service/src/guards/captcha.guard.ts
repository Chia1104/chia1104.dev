import { createMiddleware } from "hono/factory";

import {
  X_CAPTCHA_RESPONSE,
  captchaSiteverifyWithCredentials,
} from "@chia/api/captcha";
import { applyPolicy } from "@chia/service-kit/adapters/hono";
import { captchaPolicy } from "@chia/service-kit/policies/captcha.policy";

/**
 * Verifies the `x-captcha-response` header. For Hono routes whose body belongs to someone else
 * (better-auth), where the token cannot ride in validated input as it does over oRPC.
 */
export const captchaGuard = () =>
  createMiddleware<HonoContext>(async (c, next) => {
    const denied = await applyPolicy(
      c,
      captchaPolicy({
        token: c.req.header(X_CAPTCHA_RESPONSE),
        verify: (credentials) => captchaSiteverifyWithCredentials(credentials),
      })
    );

    if (denied) {
      return denied;
    }

    await next();
  });
