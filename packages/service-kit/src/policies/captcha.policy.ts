import { AppError } from "../errors";

import type { Policy } from "./types";
import { allow, deny } from "./types";

/** Kept as literals so this package needs no dependency on `@chia/api`. */
export const CaptchaErrorCode = {
  Required: "CAPTCHA_REQUIRED",
  Failed: "CAPTCHA_FAILED",
} as const;

export interface CaptchaPolicyOptions {
  /** Caller-supplied token, resolved by the procedure from validated input. */
  token: string | undefined;
  /**
   * Provider round trip. Injected so this package does not depend on `@chia/api`.
   * Wire with `captchaSiteverifyWithCredentials` from `@chia/api/captcha`.
   */
  verify: (credentials: {
    token: string;
    remoteip: string;
  }) => Promise<{ success: boolean }>;
}

/** Verifies a captcha token, attributed to the caller's IP. */
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
        error instanceof Error && "code" in error
          ? String(error.code)
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
