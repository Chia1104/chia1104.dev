import { parse } from "hono/utils/cookie";

import { KEY_COOKIE_NAMES } from "@chia/ai/provider";
import type { EncryptedAgentCredentials } from "@chia/workflow-control/agent-hooks";

/**
 * Ciphertext crosses the workflow boundary (it is journaled); decrypt only inside the turn.
 * Cookies are the same ones `/ai/key:signed` writes.
 */

/** A missing cookie returns undefined; sessions on the house gateway key need none. */
export const readEncryptedAgentCredentials = (
  headers: Headers
): EncryptedAgentCredentials | undefined => {
  const cookies = parse(headers.get("Cookie") ?? "");
  const credentials: EncryptedAgentCredentials = {};
  for (const [providerId, cookieName] of Object.entries(KEY_COOKIE_NAMES)) {
    const encoded = cookies[cookieName];
    if (encoded) {
      credentials[
        /* SAFETY: The producer contract guarantees this value satisfies keyof EncryptedAgentCredentials. */ providerId as keyof EncryptedAgentCredentials
      ] = encoded;
    }
  }
  return Object.keys(credentials).length > 0 ? credentials : undefined;
};
