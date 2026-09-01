import { parse } from "hono/utils/cookie";

import { decryptAgentCredentials as decryptCredentials } from "@chia/agent-host/credentials";
export { AgentCredentialError } from "@chia/agent-host/credentials";
import { ANTHROPIC_API_KEY, OPENAI_API_KEY } from "@chia/ai/constants";
import type { EncryptedAgentCredentials } from "@chia/workflow-control/agent-hooks";

import { env } from "../env";

/**
 * Ciphertext crosses the workflow boundary (it is journaled); decrypt only inside the turn.
 * Cookies are the same ones `/ai/key:signed` writes.
 */

const COOKIE_BY_PROVIDER = {
  openai: OPENAI_API_KEY,
  anthropic: ANTHROPIC_API_KEY,
} as const;

/** A missing cookie returns undefined; house-gateway sessions need no key. */
export const readEncryptedAgentCredentials = (
  headers: Headers
): EncryptedAgentCredentials | undefined => {
  const cookies = parse(headers.get("Cookie") ?? "");
  const credentials: EncryptedAgentCredentials = {};
  for (const [providerId, cookieName] of Object.entries(COOKIE_BY_PROVIDER)) {
    const encoded = cookies[cookieName];
    if (encoded) {
      credentials[
        /* SAFETY: The producer contract guarantees this value satisfies keyof EncryptedAgentCredentials. */ providerId as keyof EncryptedAgentCredentials
      ] = encoded;
    }
  }
  return Object.keys(credentials).length > 0 ? credentials : undefined;
};

/**
 * A decrypt failure is usually a rotated `AI_AUTH_PUBLIC_KEY`; report it instead of dropping,
 * or the turn looks like an unregistered provider.
 */
export const decryptAgentCredentials = (
  encrypted: EncryptedAgentCredentials | undefined
) => decryptCredentials(encrypted, env.AI_AUTH_PRIVATE_KEY);
