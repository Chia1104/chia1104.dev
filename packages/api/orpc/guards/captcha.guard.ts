import { runPolicy } from "@chia/service-kit/adapters/orpc";
import { captchaPolicy } from "@chia/service-kit/policies/captcha.policy";

import { captchaSiteverifyWithCredentials } from "../../captcha";
import { baseOS } from "../utils";

export interface CaptchaGuardInput {
  token: string | undefined;
}

/**
 * Verifies the captcha token mapped in via `.use(captchaGuard.adaptInput((input) => ({ token: input.captchaToken })))`.
 * The verifier is injected because `@chia/service-kit` cannot depend on `@chia/api`.
 */
export const captchaGuard = baseOS
  .errors({
    BAD_REQUEST: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .middleware(async ({ next, context }, input: CaptchaGuardInput) => {
    await runPolicy(
      captchaPolicy({
        token: input.token,
        verify: (credentials) => captchaSiteverifyWithCredentials(credentials),
      }),
      context
    );

    return next();
  });
