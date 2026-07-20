import { createMiddleware } from "hono/factory";

import { decodeTrustedHeader, X_CH_AUTH_API_KEY } from "@chia/auth/gateway";
import { APIError } from "@chia/auth/types";
import { X_CH_API_KEY } from "@chia/auth/utils";
import type { ApiKey } from "@chia/db/schema";
import { tryCatch } from "@chia/utils/error-helper";
import { errorGenerator } from "@chia/utils/server";

/**
 * Local equivalent of better-auth's api-key permission check: every required
 * action of every required resource must be granted by the key. The gate
 * verifies keys without route-specific permissions, so the fine-grained check
 * happens here against the key metadata it injected.
 */
const hasRequiredPermissions = (
  keyPermissions: unknown,
  required: Record<string, string[]>
): boolean => {
  let granted = keyPermissions;
  if (typeof granted === "string") {
    try {
      granted = JSON.parse(granted);
    } catch {
      return false;
    }
  }
  if (!granted || typeof granted !== "object") return false;
  return Object.entries(required).every(([resource, actions]) =>
    actions.every((action) =>
      (granted as Record<string, string[] | undefined>)[resource]?.includes(
        action
      )
    )
  );
};

export const apikeyVerify = (options?: {
  permissions?: Record<string, string[]>;
  projectId?: number;
}) =>
  createMiddleware<HonoContext>(async (c, next) => {
    const { permissions, projectId } = options ?? {};
    const chApiKey = c.req.raw.headers.get(X_CH_API_KEY);

    if (!chApiKey) {
      return c.json(
        errorGenerator(401, [
          {
            field: "api_key",
            message: "Missing or invalid API key",
          },
        ]),
        401
      );
    }

    // fast path: the edge gateway already verified the key and injected its
    // metadata — only the route-specific checks remain
    const trustedKey = decodeTrustedHeader<Omit<ApiKey, "key">>(
      c.req.raw.headers.get(X_CH_AUTH_API_KEY)
    );

    if (trustedKey) {
      if (
        permissions &&
        !hasRequiredPermissions(trustedKey.permissions, permissions)
      ) {
        return c.json(errorGenerator(403), 403);
      }
      if (
        trustedKey.projectId &&
        projectId &&
        trustedKey.projectId !== projectId
      ) {
        return c.json(errorGenerator(403), 403);
      }
      await next();
      return;
    }

    if (!c.var.auth) return c.json({ message: "Unauthorized" }, 401);

    const { data: apiKey, error: apiKeyError } = await tryCatch(
      c.var.auth.api.verifyApiKey({
        headers: c.req.raw.headers,
        body: {
          key: chApiKey,
          permissions,
        },
      })
    );

    if (apiKeyError || apiKey.error) {
      if (apiKeyError instanceof APIError) {
        return c.json(errorGenerator(apiKeyError.statusCode), 403);
      }
      switch (apiKey?.error?.code) {
        case "KEY_NOT_FOUND":
          return c.json(
            errorGenerator(404, [
              {
                field: "api_key",
                message: "API key not found",
                code: "KEY_NOT_FOUND",
              },
            ]),
            404
          );
        case "KEY_DISABLED":
          return c.json(
            errorGenerator(403, [
              {
                field: "api_key",
                message: "API key is disabled",
                code: "KEY_DISABLED",
              },
            ]),
            403
          );
        case "KEY_EXPIRED":
          return c.json(
            errorGenerator(403, [
              {
                field: "api_key",
                message: "API key is expired",
                code: "KEY_EXPIRED",
              },
            ]),
            403
          );
        case "RATE_LIMITED":
          return c.json(
            errorGenerator(429, [
              {
                field: "api_key",
                message: "API key is rate limited",
                code: "RATE_LIMITED",
              },
            ]),
            429
          );
        case "USAGE_EXCEEDED":
          return c.json(
            errorGenerator(403, [
              {
                field: "api_key",
                message: "API key usage exceeded",
                code: "USAGE_EXCEEDED",
              },
            ]),
            403
          );
      }
      c.var.sentry.captureException(apiKeyError);
      return c.json(errorGenerator(403), 403);
    }

    if (!apiKey.valid || !apiKey.key) {
      return c.json(errorGenerator(403), 403);
    }

    const key = apiKey.key as Omit<ApiKey, "key">;

    if (key.projectId) {
      if (projectId && key.projectId !== projectId) {
        return c.json(errorGenerator(403), 403);
      }
    }

    await next();
  });
