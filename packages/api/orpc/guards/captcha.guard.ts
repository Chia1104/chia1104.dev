import { runPolicy } from "@chia/service-kit/adapters/orpc";
import { captchaPolicy } from "@chia/service-kit/policies";

import { captchaSiteverifyWithCredentials } from "../../captcha";
import { baseOS } from "../utils";

export interface CaptchaGuardInput {
  token: string | undefined;
}

/**
 * Verifies the caller's captcha token, which the procedure maps in from its validated
 * input via `.use(captchaGuard, (input) => ({ token: input.captchaToken }))`.
 *
 * The verifier is injected into the policy because `@chia/service-kit` cannot depend on
 * `@chia/api` — that would be a cycle. Here we are inside `@chia/api`, so the wiring is
 * a local import.
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
