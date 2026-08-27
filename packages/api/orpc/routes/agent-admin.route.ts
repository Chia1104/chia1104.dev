import { withORPCErrors } from "@chia/service-kit/adapters/orpc";

import { adminGuard } from "../guards/admin.guard";
import { requireAgentAdminService } from "../services/agent-admin.service";
import type { AgentAdminCaller } from "../services/agent-admin.service";
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
    withORPCErrors(() =>
      requireAgentAdminService(opts.context).listKinds(callerOf(opts))
    )
  );

export const updateAgentKindAdminRoute = contractOS.agent.admin.kinds.update
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(() =>
      requireAgentAdminService(opts.context).updateKind(
        callerOf(opts),
        opts.input
      )
    )
  );

export const listAgentTasksAdminRoute = contractOS.agent.admin.tasks.list
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(() =>
      requireAgentAdminService(opts.context).listTasks(callerOf(opts))
    )
  );

export const updateAgentTaskAdminRoute = contractOS.agent.admin.tasks.update
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(() =>
      requireAgentAdminService(opts.context).updateTask(
        callerOf(opts),
        opts.input
      )
    )
  );

export const listAgentTaskModelsAdminRoute = contractOS.agent.admin.tasks.models
  .use(adminGuard())
  .handler((opts) =>
    withORPCErrors(() =>
      requireAgentAdminService(opts.context).listTaskModels()
    )
  );
