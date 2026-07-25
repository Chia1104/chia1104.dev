import { AppError } from "../errors";

import type { Policy } from "./types";
import { allow, deny } from "./types";

/** Kept as literals so this package needs no dependency on `@chia/api`. */
export const CaptchaErrorCode = {
  Required: "CAPTCHA_REQUIRED",
  Failed: "CAPTCHA_FAILED",
} as const;

export interface CaptchaPolicyOptions {
  /**
   * The caller-supplied token. Resolved by the procedure from its validated input, since
   * a policy only ever sees the service context.
   */
  token: string | undefined;
  /**
   * Performs the provider round trip. Injected rather than imported so `service-kit`
   * stays free of a dependency on `@chia/api`, which depends on this package.
   *
   * Wire it with `captchaSiteverifyWithCredentials` from `@chia/api/captcha`.
   */
  verify: (credentials: {
    token: string;
    remoteip: string;
  }) => Promise<{ success: boolean }>;
}

/**
 * Verifies a captcha token against the provider, attributing the attempt to the caller's
 * IP.
 */
export const captchaPolicy = (options: CaptchaPolicyOptions): Policy => {
  return async (context) => {
    if (!options.token) {
      return deny(
        new AppError("BAD_REQUEST", {
          issues: [{ field: "captcha", message: CaptchaErrorCode.Required }],
        })
      );
    }

    try {
      const result = await options.verify({
        token: options.token,
        remoteip: context.clientIP,
      });

      if (!result.success) {
        console.error("Captcha service response failed: ", {
          error: CaptchaErrorCode.Failed,
          response: result,
        });
        return deny(
          new AppError("BAD_REQUEST", {
            issues: [{ field: "captcha", message: CaptchaErrorCode.Failed }],
          })
        );
      }
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: unknown }).code)
          : undefined;

      console.error("Captcha error: ", { error: code, response: error });

      // A provider misconfiguration is ours, not the caller's.
      if (!code) {
        return deny(new AppError("INTERNAL_SERVER_ERROR", { cause: error }));
      }

      return deny(
        new AppError("BAD_REQUEST", {
          issues: [{ field: "captcha", message: code }],
          cause: error,
        })
      );
    }

    return allow();
  };
};
