import { getRun } from "workflow/api";

import { decryptAgentCredentials } from "@chia/agent-host/credentials";
import { createAgentFactory } from "@chia/services/agent/agent.factory";

import { env } from "../env";
import { readEncryptedAgentCredentials } from "../services/agent-credentials.service";

import { agentKindFloors } from "./kinds";

/** Host bindings only; all session, turn, maintenance and admin behavior lives in oRPC. */
export const agentFactory = createAgentFactory({
  kinds: {
    writing: {
      minTier: agentKindFloors.writing,
      load: () => import("./writing").then((module) => module.writingAgentKind),
    },
    public: {
      minTier: agentKindFloors.public,
      load: () => import("./public").then((module) => module.publicAgentKind),
    },
  },
  credentials: {
    read: readEncryptedAgentCredentials,
    decrypt: (encrypted) =>
      decryptAgentCredentials(encrypted, env.AI_AUTH_PRIVATE_KEY),
  },
  runs: {
    get: getRun,
  },
});
