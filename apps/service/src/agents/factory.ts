import { getHookByToken, getRun } from "workflow/api";

import { createAgentFactory } from "@chia/api/orpc/services/agent.factory";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

import {
  decryptAgentCredentials,
  readEncryptedAgentCredentials,
} from "../services/agent-credentials.service";

/** Host bindings only; all session, turn, maintenance and admin behavior lives in oRPC. */
export const agentFactory = createAgentFactory({
  kinds: {
    writing: {
      minTier: CallerTier.Root,
      load: () => import("./writing").then((module) => module.writingAgentKind),
    },
    public: {
      minTier: CallerTier.Root,
      load: () => import("./public").then((module) => module.publicAgentKind),
    },
  },
  credentials: {
    read: readEncryptedAgentCredentials,
    decrypt: decryptAgentCredentials,
  },
  runs: {
    get: getRun,
    hasHook: async (token) => Boolean(await getHookByToken(token)),
  },
});
