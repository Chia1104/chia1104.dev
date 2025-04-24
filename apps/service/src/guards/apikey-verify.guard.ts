import { createMiddleware } from "hono/factory";

import { auth } from "@chia/auth";
import { APIError } from "@chia/auth/types";
import { X_CH_API_KEY } from "@chia/auth/utils";
import type { ApiKey } from "@chia/db/schema";
import { errorGenerator } from "@chia/utils";
import { tryCatch } from "@chia/utils/try-catch";

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

    const { data: apiKey, error: apiKeyError } = await tryCatch(
      auth.api.verifyApiKey({
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
