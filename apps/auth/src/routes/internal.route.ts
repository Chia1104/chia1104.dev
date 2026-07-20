import { Hono } from "hono";
import { timeout } from "hono/timeout";

import {
  encodeTrustedHeader,
  X_CH_AUTH_API_KEY,
  X_CH_AUTH_SESSION,
} from "@chia/auth/gateway";
import { APIError } from "@chia/auth/types";
import { X_CH_API_KEY } from "@chia/auth/utils";
import { tryCatch } from "@chia/utils/error-helper";

import { env } from "../env";
import { internalGuard } from "../guards/internal.guard";

/**
 * Server-to-server routes wrapping better-auth SERVER_ONLY methods that are
 * not exposed through `auth.handler`. Consumed by `createRemoteAuthGateway`
 * and the edge gateway's `forward_auth`.
 */
const api = new Hono<HonoContext>()
  .use(timeout(env.TIMEOUT_MS))
  .use(internalGuard())
  /**
   * Edge-auth endpoint for Caddy `forward_auth` (or nginx `auth_request`).
   * Authenticates the request by session cookie or API key and answers with
   * a status code plus identity headers for `copy_headers`:
   * - 204 with `x-ch-auth-session` / `x-ch-auth-api-key` when authenticated
   * - 204 without identity headers when anonymous and `?mode=optional`
   * - 401 otherwise (only 401/403 are emitted, for nginx compatibility)
   */
  .get("/gate", async (c) => {
    const mode = c.req.query("mode") ?? "required";
    const headers = c.req.raw.headers;

    const { data: session } = await tryCatch(
      c.var.auth.api.getSession({ headers })
    );

    if (session) {
      c.header(X_CH_AUTH_SESSION, encodeTrustedHeader(session));
      return c.body(null, 204);
    }

    const apiKey = headers.get(X_CH_API_KEY);

    if (apiKey) {
      const { data: result, error } = await tryCatch(
        c.var.auth.api.verifyApiKey({
          headers,
          body: { key: apiKey },
        })
      );

      if (error) {
        if (error instanceof APIError) {
          return c.json(
            { code: error.body?.code, message: error.body?.message },
            error.statusCode === 403 ? 403 : 401
          );
        }
        throw error;
      }

      if (result.valid && result.key) {
        c.header(X_CH_AUTH_API_KEY, encodeTrustedHeader(result.key));
        return c.body(null, 204);
      }

      return c.json(
        {
          code: result.error?.code,
          message: result.error?.message ?? "Invalid API key",
        },
        401
      );
    }

    if (mode === "optional") {
      return c.body(null, 204);
    }

    return c.json({ message: "Unauthorized" }, 401);
  })
  .post("/verify-api-key", async (c) => {
    const body = await c.req.json<{
      key: string;
      permissions?: Record<string, string[]>;
    }>();

    const { data, error } = await tryCatch(
      c.var.auth.api.verifyApiKey({
        headers: c.req.raw.headers,
        body,
      })
    );

    if (error) {
      if (error instanceof APIError) {
        return c.json(
          {
            code: error.body?.code,
            message: error.body?.message,
          },
          error.statusCode as never
        );
      }
      throw error;
    }

    return c.json(data);
  });

export default api;
