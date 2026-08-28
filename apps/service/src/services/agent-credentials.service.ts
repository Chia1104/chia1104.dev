import { parse } from "hono/utils/cookie";

import { decryptAgentCredentials as decryptCredentials } from "@chia/agent-host/credentials";
export { AgentCredentialError } from "@chia/agent-host/credentials";
import { ANTHROPIC_API_KEY, OPENAI_API_KEY } from "@chia/ai/constants";
import type { EncryptedAgentCredentials } from "@chia/workflow-control/agent-hooks";

import { env } from "../env";

/**
 * Bring-your-own-key plumbing for agent turns.
 *
 * Two halves, deliberately kept apart:
 *
 * - {@link readEncryptedAgentCredentials} runs at the HTTP boundary and only *moves* ciphertext out
 *   of the cookie. It never decrypts, because what it produces is handed to the workflow, and
 *   everything crossing that boundary is journaled durably.
 * - {@link decryptAgentCredentials} runs inside the turn step, at the last possible moment.
 *
 * The cookies are the same ones `/ai/key:signed` writes for the Vercel AI SDK routes
 * (`apps/service/src/routes/ai.route.ts`), so an operator who has already registered a key for
 * those gets it here for free.
 */

const COOKIE_BY_PROVIDER = {
  openai: OPENAI_API_KEY,
  anthropic: ANTHROPIC_API_KEY,
} as const;

/**
 * Lifts whatever provider keys the caller has registered out of their cookies.
 *
 * Deliberately **not** `aiKeyPolicy`: that policy denies the request when a key is missing, which is
 * right for the AI SDK routes where the key *is* the auth. Here bring-your-own-key is optional —
 * a session on the house gateway account needs none — so a missing cookie is a normal state, not a
 * rejection. Returns undefined when there is nothing at all to carry.
 */
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
 * Decrypts the ciphertext carried across the workflow boundary.
 *
 * A key that fails to decrypt is almost always one encrypted under a rotated `AI_AUTH_PUBLIC_KEY`,
 * so it is reported as something the operator can fix rather than as an internal error. Silently
 * dropping it would be worse: the turn would fall through to "provider not registered" and the
 * operator would be told their model does not exist.
 */
export const decryptAgentCredentials = (
  encrypted: EncryptedAgentCredentials | undefined
) => decryptCredentials(encrypted, env.AI_AUTH_PRIVATE_KEY);
