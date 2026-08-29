import type { AgentUsageService } from "@chia/api/orpc/services/agent-usage.service";

/**
 * `AgentUsageService` for this app. Lazy like the admin delegate: the quota module reaches
 * `@chia/agent-runtime/models` for the house provider id, which loads the provider stack, and
 * this module sits on the boot path of every process that hosts the router.
 */
export const agentUsageService: AgentUsageService = {
  async standing(caller) {
    const [{ readAgentUsageStanding }, { reconcileRunningAgentTurns }] =
      await Promise.all([
        import("@chia/agent-host/quota"),
        import("../services/agent-run-liveness.service"),
      ]);
    // What the client shows as running must be what is running, not what a dead step left.
    await reconcileRunningAgentTurns(caller.context.db, caller.userId);
    return readAgentUsageStanding(caller.context.db, caller);
  },
};
