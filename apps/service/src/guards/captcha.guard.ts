import { createMiddleware } from "hono/factory";

import { captchaSiteverifyWithCredentials } from "@chia/integrations/captcha";
import { X_CAPTCHA_RESPONSE } from "@chia/integrations/captcha/constants";
import { applyPolicy } from "@chia/service-kit/adapters/hono";
import { captchaPolicy } from "@chia/service-kit/policies/captcha.policy";

/**
 * Verifies the `x-captcha-response` header, for Hono routes where the token does not ride in
 * validated input as it does over oRPC.
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
