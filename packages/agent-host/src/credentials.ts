import type { AgentCredentials } from "@chia/agent-runtime/models";
import { KeyId } from "@chia/ai/provider";
import { verifyApiKey } from "@chia/ai/utils";
import type { EncryptedAgentCredentials } from "@chia/workflow-control/agent-schema";

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
  for (const keyId of Object.values(KeyId)) {
    const encoded = encrypted[keyId];
    if (!encoded) continue;
    try {
      credentials[keyId] = verifyApiKey(encoded, privateKey).apiKey;
    } catch (error) {
      throw new AgentCredentialError(keyId, { cause: error });
    }
  }
  return credentials;
};
