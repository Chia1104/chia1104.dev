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
    const { data: apiKey, error: apiKeyError } = await tryCatch(
      auth.api.verifyApiKey({
        headers: c.req.raw.headers,
        body: {
          key: c.req.raw.headers.get(X_CH_API_KEY) ?? "",
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
              },
            ]),
            403
          );
      }
      return c.json(errorGenerator(500), 500);
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
