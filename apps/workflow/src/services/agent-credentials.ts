import { decryptAgentCredentials as decryptCredentials } from "@chia/agent-host/credentials";
import type { EncryptedAgentCredentials } from "@chia/workflow-control/agent-hooks";

import { env } from "../env";

export const decryptAgentCredentials = (
  encrypted: EncryptedAgentCredentials | undefined
) => decryptCredentials(encrypted, env.AI_AUTH_PRIVATE_KEY);
