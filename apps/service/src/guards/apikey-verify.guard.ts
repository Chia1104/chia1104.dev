import { toHonoMiddleware } from "@chia/service-kit/adapters/hono";
import type { ApiKeyPolicyOptions } from "@chia/service-kit/policies";
import { apiKeyPolicy } from "@chia/service-kit/policies";

/**
 * Verifies the `X-CH-API-KEY` header. The verified key lands on `c.var.apiKey`.
 */
export const apikeyVerify = (options?: ApiKeyPolicyOptions) =>
  toHonoMiddleware(apiKeyPolicy(options));
