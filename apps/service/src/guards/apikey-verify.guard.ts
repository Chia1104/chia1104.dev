import { createMiddleware } from "hono/factory";

import { auth } from "@chia/auth";
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
      console.error(apiKeyError ?? apiKey.error);
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
