import { withORPCErrors } from "@chia/service-kit/adapters/orpc";

import { adminGuard } from "../guards/admin.guard";
import { requireAgentFactory } from "../services/agent.service";
import type { AgentAdminCaller } from "../services/agent/admin";
import { contractOS } from "../utils";

/**
 * Agent configuration routes — the dashboard's agent workspace.
 *
 * **Every route is `adminGuard()`, reads included.** A task's prompt is an instruction to the
 * model and a kind's defaults decide what every new session runs on; neither is for anyone
 * but the configured author.
 */

const callerOf = (opts: {
  context: { adminId: string; db: AgentAdminCaller["db"] };
}): AgentAdminCaller => ({
  adminId: opts.context.adminId,
  db: opts.context.db,
});

export const listAgentKindsAdminRoute = contractOS.agent.admin.kinds.list
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(async () =>
      (await requireAgentFactory(opts.context).createAdmin()).listKinds(
        callerOf(opts)
      )
    )
  );

export const updateAgentKindAdminRoute = contractOS.agent.admin.kinds.update
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(async () =>
      (await requireAgentFactory(opts.context).createAdmin()).updateKind(
        callerOf(opts),
        opts.input
      )
    )
  );

export const listAgentTasksAdminRoute = contractOS.agent.admin.tasks.list
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(async () =>
      (await requireAgentFactory(opts.context).createAdmin()).listTasks(
        callerOf(opts)
      )
    )
  );

export const updateAgentTaskAdminRoute = contractOS.agent.admin.tasks.update
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(async () =>
      (await requireAgentFactory(opts.context).createAdmin()).updateTask(
        callerOf(opts),
        opts.input
      )
    )
  );

export const getAgentQuotaAdminRoute = contractOS.agent.admin.quota.get
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(async () =>
      (await requireAgentFactory(opts.context).createAdmin()).getQuota(
        callerOf(opts)
      )
    )
  );

export const updateAgentQuotaAdminRoute = contractOS.agent.admin.quota.update
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(async () =>
      (await requireAgentFactory(opts.context).createAdmin()).updateQuota(
        callerOf(opts),
        opts.input
      )
    )
  );

export const listAgentTaskModelsAdminRoute = contractOS.agent.admin.tasks.models
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(async () =>
      (await requireAgentFactory(opts.context).createAdmin()).listTaskModels()
    )
  );
