import { parse } from "hono/utils/cookie";

import { KEY_COOKIE_NAMES, KeyId } from "@chia/ai/provider";
import type { EncryptedAgentCredentials } from "@chia/workflow-control/agent-schema";

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
  for (const keyId of Object.values(KeyId)) {
    const encoded = cookies[KEY_COOKIE_NAMES[keyId]];
    if (encoded) {
      credentials[keyId] = encoded;
    }
  }
  return Object.keys(credentials).length > 0 ? credentials : undefined;
};
