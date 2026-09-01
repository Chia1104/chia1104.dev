import { parse } from "hono/utils/cookie";

import { AppError } from "../errors";

import type { Policy } from "./types";
import { allow, deny } from "./types";

export const AI_AUTH_TOKEN = "AI_AUTH_TOKEN";

export interface AiKeyPolicyOptions {
  /**
   * Cookie holding the encoded provider key. Resolved by the caller: request
   * data never reaches a policy directly.
   */
  cookieName?: string;
  /**
   * Decodes and verifies the cookie. Injected so this package does not depend
   * on `@chia/ai`; wire with `verifyApiKey` from `@chia/ai/utils`.
   */
  verify: (encoded: string) => { apiKey: string } | Promise<{ apiKey: string }>;
}

const missingKey = () =>
  new AppError("UNAUTHORIZED", {
    issues: [{ field: "api_key", message: "Missing or invalid API key" }],
  });

/**
 * Resolves a caller-supplied provider API key from cookies into
 * `context.AI_AUTH_TOKEN` for downstream handlers.
 */
export const aiKeyPolicy = (
  options: AiKeyPolicyOptions
): Policy<{ [AI_AUTH_TOKEN]: string }> => {
  return async (context) => {
    if (!options.cookieName) {
      return deny(missingKey());
    }

    const cookies = parse(context.headers.get("Cookie") ?? "");
    const encoded = cookies[options.cookieName];

    if (!encoded) {
      return deny(missingKey());
    }

    try {
      const { apiKey } = await options.verify(encoded);
      if (!apiKey) {
        return deny(missingKey());
      }
      return allow({ [AI_AUTH_TOKEN]: apiKey });
    } catch (error) {
      return deny(
        new AppError("UNAUTHORIZED", {
          issues: [{ field: "api_key", message: "Missing or invalid API key" }],
          cause: error,
        })
      );
    }
  };
};
