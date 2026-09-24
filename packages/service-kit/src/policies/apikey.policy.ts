import type { ApiKeyScope } from "@chia/auth/apikey";
import { hasApiKeyScope } from "@chia/auth/apikey";
import type { Auth } from "@chia/auth/server";
import { APIError } from "@chia/auth/types";
import { X_CH_API_KEY } from "@chia/auth/utils";

import { AppError, AppErrorCode, appErrorCodeFromStatus } from "../errors";

import type { Policy } from "./types";
import { allow, deny } from "./types";

type VerifyApiKeyResult = Awaited<ReturnType<Auth["api"]["verifyApiKey"]>>;

/** The key row better-auth verified, with `permissions` and `metadata` already parsed. */
export type VerifiedApiKey = NonNullable<VerifyApiKeyResult["key"]>;

export interface ApiKeyPolicyOptions {
  /** Every listed scope must be on the key. */
  scopes?: readonly ApiKeyScope[];
}

const invalidKey = (
  code: AppErrorCode,
  message: string,
  keyCode?: string
): AppError =>
  new AppError(code, {
    issues: [{ field: "api_key", message, code: keyCode }],
  });

/** Maps better-auth `verifyApiKey` failure codes onto {@link AppError}. */
const KEY_ERRORS = new Map<string, AppError>([
  [
    "KEY_NOT_FOUND",
    invalidKey(AppErrorCode.NotFound, "API key not found", "KEY_NOT_FOUND"),
  ],
  [
    "KEY_DISABLED",
    invalidKey(AppErrorCode.Forbidden, "API key is disabled", "KEY_DISABLED"),
  ],
  [
    "KEY_EXPIRED",
    invalidKey(AppErrorCode.Forbidden, "API key is expired", "KEY_EXPIRED"),
  ],
  [
    "RATE_LIMITED",
    invalidKey(
      AppErrorCode.TooManyRequests,
      "API key is rate limited",
      "RATE_LIMITED"
    ),
  ],
  [
    "USAGE_EXCEEDED",
    invalidKey(
      AppErrorCode.Forbidden,
      "API key usage exceeded",
      "USAGE_EXCEEDED"
    ),
  ],
]);

/**
 * Verifies the `X-CH-API-KEY` header against better-auth's api-key plugin, then checks the
 * key's scopes locally so a missing scope is FORBIDDEN rather than better-auth's NOT_FOUND.
 */
export const apiKeyPolicy = (
  options: ApiKeyPolicyOptions = {}
): Policy<{ apiKey: VerifiedApiKey }> => {
  return async (context) => {
    const key = context.headers.get(X_CH_API_KEY);

    if (!key) {
      return deny(
        invalidKey(
          AppErrorCode.Unauthorized,
          "Missing or invalid API key",
          undefined
        )
      );
    }

    if (!context.auth) {
      return deny(new AppError(AppErrorCode.Unauthorized));
    }

    let verified: VerifyApiKeyResult;

    try {
      verified = await context.auth.api.verifyApiKey({
        headers: context.headers,
        body: { key },
      });
    } catch (error) {
      if (error instanceof APIError) {
        return deny(
          new AppError(appErrorCodeFromStatus(Number(error.statusCode)), {
            cause: error,
          })
        );
      }
      // Not the caller's doing: the verifier itself failed, so the edge reports it as a 5xx.
      return deny(
        new AppError(AppErrorCode.InternalServerError, { cause: error })
      );
    }

    if (verified.error) {
      const mapped = verified.error.code
        ? KEY_ERRORS.get(verified.error.code)
        : undefined;
      return deny(mapped ?? new AppError(AppErrorCode.Forbidden));
    }

    const apiKey = verified.key;
    if (!verified.valid || !apiKey) {
      return deny(new AppError(AppErrorCode.Forbidden));
    }

    const missing = missingApiKeyScope(apiKey, options.scopes);
    if (missing) {
      return deny(missing);
    }

    return allow({ apiKey });
  };
};

/** The FORBIDDEN to raise when `apiKey` lacks one of `scopes`, or nothing when it has them all. */
export const missingApiKeyScope = (
  apiKey: VerifiedApiKey,
  scopes: readonly ApiKeyScope[] | undefined
): AppError | undefined => {
  const missing = scopes?.find(
    (scope) => !hasApiKeyScope(apiKey.permissions, scope)
  );
  return missing
    ? invalidKey(
        AppErrorCode.Forbidden,
        `API key lacks the ${missing} scope`,
        "SCOPE_MISSING"
      )
    : undefined;
};
