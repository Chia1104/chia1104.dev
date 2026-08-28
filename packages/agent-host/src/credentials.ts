import type { AgentCredentials } from "@chia/agent-runtime/models";
import { verifyApiKey } from "@chia/ai/utils";
import type { EncryptedAgentCredentials } from "@chia/workflow-control/agent-hooks";

export class AgentCredentialError extends Error {
  constructor(
    readonly providerId: string,
    options?: { cause?: unknown }
  ) {
    super(
      `Your ${providerId} API key could not be read. Register it again, then retry.`,
      options
    );
    this.name = "AgentCredentialError";
  }
}

export const decryptAgentCredentials = (
  encrypted: EncryptedAgentCredentials | undefined,
  privateKey: string | undefined
): AgentCredentials => {
  if (!encrypted || !privateKey) return {};

  const credentials: AgentCredentials = {};
  for (const [providerId, encoded] of Object.entries(encrypted)) {
    if (!encoded) continue;
    try {
      credentials[
        /* SAFETY: The producer contract guarantees this value satisfies keyof AgentCredentials. */ providerId as keyof AgentCredentials
      ] = verifyApiKey(encoded, privateKey).apiKey;
    } catch (error) {
      throw new AgentCredentialError(providerId, { cause: error });
    }
  }
  return credentials;
};
