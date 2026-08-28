import type { DB } from "@chia/db/client";
import { toORPCError } from "@chia/service-kit/adapters/orpc";
import { AppError } from "@chia/service-kit/errors";
import type { JsonObject } from "@chia/utils/json";

import type * as contracts from "../contracts/agent-admin.contract";
import type { AgentModelInfo } from "../contracts/agent.contract";
import type { BaseOSContext } from "../utils";

import type { AgentModelRef } from "./agent.service";

/**
 * Port for operator configuration of agent kinds and tasks.
 *
 * The registries this reads — which kinds and tasks exist, their code defaults, a kind's
 * config schema — are the host's (`apps/service/src/agents/`), so the routes cannot answer
 * from `packages/api` alone. One cross-kind port rather than a method on `AgentKindService`:
 * that service is one kind's, per caller; this is the operator's view over all of them.
 */

/** Per-call context. Admin-only by the route, so the caller is always the configured admin. */
export interface AgentAdminCaller {
  adminId: string;
  db: DB;
}

export interface AgentAdminService {
  listKinds(caller: AgentAdminCaller): Promise<contracts.AgentKindAdmin[]>;
  /** `NOT_FOUND` for an unregistered kind, `BAD_REQUEST` when a value fails the kind's policy. */
  updateKind(
    caller: AgentAdminCaller,
    input: {
      kind: string;
      model?: AgentModelRef | null;
      thinkingLevel?: string | null;
      autoApprove?: string[] | null;
      config?: JsonObject;
    }
  ): Promise<contracts.AgentKindAdmin>;

  listTasks(caller: AgentAdminCaller): Promise<contracts.AgentTaskAdmin[]>;
  /** `NOT_FOUND` for an unregistered task, `BAD_REQUEST` for a model off the house catalogue. */
  updateTask(
    caller: AgentAdminCaller,
    input: {
      id: string;
      model?: AgentModelRef | null;
      systemPrompt?: string | null;
      params?: Partial<contracts.AgentTaskParamsInput>;
    }
  ): Promise<contracts.AgentTaskAdmin>;
  listTaskModels(): Promise<AgentModelInfo[]>;

  getQuota(caller: AgentAdminCaller): Promise<contracts.AgentQuotaAdmin>;
  /** `BAD_REQUEST` for a zone the runtime does not know. */
  updateQuota(
    caller: AgentAdminCaller,
    input: { weeklyLimitUsd?: number | null; resetTimeZone?: string | null }
  ): Promise<contracts.AgentQuotaAdmin>;
}

/** The context's port, or `SERVICE_UNAVAILABLE` when this process has none. */
export const requireAgentAdminService = (
  context: BaseOSContext
): AgentAdminService => {
  if (!context.agentAdmin) {
    throw toORPCError(
      new AppError("SERVICE_UNAVAILABLE", {
        message: "Agent configuration is not available in this process.",
      })
    );
  }
  return context.agentAdmin;
};
