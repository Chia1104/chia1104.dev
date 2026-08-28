import type { AgentUsageService } from "@chia/api/orpc/services/agent-usage.service";

/**
 * `AgentUsageService` for this app. Lazy like the admin delegate: the quota module reaches
 * `@chia/agent-runtime/models` for the house provider id, which loads the provider stack, and
 * this module sits on the boot path of every process that hosts the router.
 */
export const agentUsageService: AgentUsageService = {
  standing: async (caller) =>
    (await import("@chia/agent-host/quota")).readAgentUsageStanding(
      caller.context.db,
      caller
    ),
};
