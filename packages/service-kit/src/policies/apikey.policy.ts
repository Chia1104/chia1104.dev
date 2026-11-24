import type { ApiKeyScope } from "@chia/auth/apikey";
import { hashApiKey, toApiKeyScopes } from "@chia/auth/apikey";
import { X_CH_API_KEY } from "@chia/auth/utils";
import { findApiKeyByHash, touchApiKey } from "@chia/db/repos/apikey";
import { reportError } from "@chia/observability/report";
import { tryCatch } from "@chia/utils/error-helper";

import { AppError, AppErrorCode } from "../errors";

import type { Policy } from "./types";
import { allow, deny } from "./types";

/** A key that passed verification. */
export interface VerifiedApiKey {
  id: string;
  /** The key's owner. */
  userId: string;
  scopes: ApiKeyScope[];
}

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

/** Verifies the `X-CH-API-KEY` header against the stored hashes, then checks its scopes. */
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

    const row = await findApiKeyByHash(context.db, await hashApiKey(key));

    if (!row) {
      return deny(
        invalidKey(AppErrorCode.NotFound, "API key not found", "KEY_NOT_FOUND")
      );
    }
    if (!row.enabled) {
      return deny(
        invalidKey(
          AppErrorCode.Forbidden,
          "API key is disabled",
          "KEY_DISABLED"
        )
      );
    }
    if (row.expiresAt && row.expiresAt <= new Date()) {
      return deny(
        invalidKey(AppErrorCode.Forbidden, "API key is expired", "KEY_EXPIRED")
      );
    }

    const apiKey: VerifiedApiKey = {
      id: row.id,
      userId: row.userId,
      scopes: toApiKeyScopes(row.scopes),
    };

    const missing = missingApiKeyScope(apiKey, options.scopes);
    if (missing) {
      return deny(missing);
    }

    // Bookkeeping only: a failed write must not fail or delay the request it describes.
    void tryCatch(touchApiKey(context.db, row.id)).then(({ error }) => {
      if (error) reportError(error, "API key last-used update failed");
    });

    return allow({ apiKey });
  };
};

/** The FORBIDDEN to raise when `apiKey` lacks one of `scopes`, or nothing when it has them all. */
export const missingApiKeyScope = (
  apiKey: VerifiedApiKey,
  scopes: readonly ApiKeyScope[] | undefined
): AppError | undefined => {
  const missing = scopes?.find((scope) => !apiKey.scopes.includes(scope));
  return missing
    ? invalidKey(
        AppErrorCode.Forbidden,
        `API key lacks the ${missing} scope`,
        "SCOPE_MISSING"
      )
    : undefined;
};
