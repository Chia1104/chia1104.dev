import { APIError } from "@chia/auth/types";
import { X_CH_API_KEY } from "@chia/auth/utils";
import type { ApiKey } from "@chia/db/schema";

import type { AppErrorCode } from "../errors";
import { AppError, appErrorCodeFromStatus } from "../errors";

import type { Policy } from "./types";
import { allow, deny } from "./types";

export interface ApiKeyPolicyOptions {
  permissions?: Record<string, string[]>;
  /**
   * When set, the key must belong to this project.
   */
  projectId?: number;
}

const invalidKey = (
  code: AppErrorCode,
  message: string,
  keyCode?: string
): AppError =>
  new AppError(code, {
    issues: [{ field: "api_key", message, code: keyCode }],
  });

/**
 * Maps better-auth's `verifyApiKey` failure codes onto {@link AppError}, preserving the
 * exact status codes and issue payloads the previous Hono guard returned.
 */
const KEY_ERRORS = new Map<string, AppError>([
  [
    "KEY_NOT_FOUND",
    invalidKey("NOT_FOUND", "API key not found", "KEY_NOT_FOUND"),
  ],
  [
    "KEY_DISABLED",
    invalidKey("FORBIDDEN", "API key is disabled", "KEY_DISABLED"),
  ],
  ["KEY_EXPIRED", invalidKey("FORBIDDEN", "API key is expired", "KEY_EXPIRED")],
  [
    "RATE_LIMITED",
    invalidKey("TOO_MANY_REQUESTS", "API key is rate limited", "RATE_LIMITED"),
  ],
  [
    "USAGE_EXCEEDED",
    invalidKey("FORBIDDEN", "API key usage exceeded", "USAGE_EXCEEDED"),
  ],
]);

/**
 * Verifies the `X-CH-API-KEY` header against better-auth's api-key plugin.
 */
export const apiKeyPolicy = (
  options: ApiKeyPolicyOptions = {}
): Policy<{ apiKey: Omit<ApiKey, "key"> }> => {
  return async (context) => {
    const key = context.headers.get(X_CH_API_KEY);

    if (!key) {
      return deny(
        invalidKey("UNAUTHORIZED", "Missing or invalid API key", undefined)
      );
    }

    if (!context.auth) {
      return deny(new AppError("UNAUTHORIZED"));
    }

    let verified: Awaited<
      ReturnType<NonNullable<typeof context.auth>["api"]["verifyApiKey"]>
    >;

    try {
      verified = await context.auth.api.verifyApiKey({
        headers: context.headers,
        body: { key, permissions: options.permissions },
      });
    } catch (error) {
      if (error instanceof APIError) {
        return deny(
          new AppError(appErrorCodeFromStatus(Number(error.statusCode)), {
            cause: error,
          })
        );
      }
      return deny(new AppError("FORBIDDEN", { cause: error }));
    }

    if (verified.error) {
      const mapped = verified.error.code
        ? KEY_ERRORS.get(verified.error.code)
        : undefined;
      return deny(mapped ?? new AppError("FORBIDDEN"));
    }

    if (!verified.valid || !verified.key) {
      return deny(new AppError("FORBIDDEN"));
    }

    const apiKey =
      /* SAFETY: The producer contract guarantees this value satisfies Omit<ApiKey, "key">. */ verified.key as Omit<
        ApiKey,
        "key"
      >;

    if (
      options.projectId !== undefined &&
      apiKey.projectId &&
      apiKey.projectId !== options.projectId
    ) {
      return deny(new AppError("FORBIDDEN"));
    }

    return allow({ apiKey });
  };
};
