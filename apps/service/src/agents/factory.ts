import { getRun } from "workflow/api";

import { createAgentFactory } from "@chia/api/orpc/services/agent.factory";

import {
  decryptAgentCredentials,
  readEncryptedAgentCredentials,
} from "../services/agent-credentials.service";

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
    decrypt: decryptAgentCredentials,
  },
  runs: {
    get: getRun,
  },
});
