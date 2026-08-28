import { toORPCError } from "@chia/service-kit/adapters/orpc";
import { AppError } from "@chia/service-kit/errors";

import type { BaseOSContext } from "../utils";

import type { AgentServiceCaller, AgentUsageStanding } from "./agent.service";

/**
 * Port for the caller's quota standing (`agent.usage.me`).
 *
 * The quota policy lives in `@chia/agent-host/quota`, which this package cannot import — the
 * host package depends on this one for the kind port. A port of one method rather than a
 * method on `AgentKindService`: the standing is the caller's, not any kind's.
 */
export interface AgentUsageService {
  standing(caller: AgentServiceCaller): Promise<AgentUsageStanding>;
}

/** The context's port, or `SERVICE_UNAVAILABLE` when this process has none. */
export const requireAgentUsageService = (
  context: BaseOSContext
): AgentUsageService => {
  if (!context.agentUsage) {
    throw toORPCError(
      new AppError("SERVICE_UNAVAILABLE", {
        message: "Agent usage is not available in this process.",
      })
    );
  }
  return context.agentUsage;
};
