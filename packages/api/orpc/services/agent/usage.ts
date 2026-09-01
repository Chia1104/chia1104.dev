import { readAgentUsageStanding } from "@chia/agent-host/quota";

import type { AgentRunHost } from "../agent.factory";
import type { AgentServiceCaller, AgentUsageStanding } from "../agent.service";

import { reconcileRunningAgentTurns } from "./run-liveness";

/**
 * The caller's quota standing (`agent.usage.me`). A port of one method rather than a
 * method on `AgentKindService`: the standing is the caller's, not any kind's.
 */
export interface AgentUsageService {
  standing(caller: AgentServiceCaller): Promise<AgentUsageStanding>;
}

export const createAgentUsageService = (
  runs: AgentRunHost
): AgentUsageService => ({
  async standing(caller) {
    await reconcileRunningAgentTurns(
      caller.context.db,
      runs,
      caller.context.workflow,
      caller.userId
    );
    return readAgentUsageStanding(caller.context.db, caller);
  },
});
