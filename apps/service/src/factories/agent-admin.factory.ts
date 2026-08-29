import type { AgentAdminService } from "@chia/api/orpc/services/agent-admin.service";

/**
 * `AgentAdminService` for this app, the process that owns the kind and task registries.
 *
 * A lazy delegate, like the kind services: the implementation loads every kind definition and
 * the task registry, which carry the domain packages and the provider stack, and this module
 * sits on the boot path of every process that hosts the router.
 */

let service: Promise<AgentAdminService> | undefined;

const impl = () => {
  service ??= import("../agents/admin").then((m) =>
    m.createAgentAdminService()
  );
  service.catch(() => (service = undefined));
  return service;
};

export const agentAdminService: AgentAdminService = {
  listKinds: async (caller) => (await impl()).listKinds(caller),
  updateKind: async (caller, input) => (await impl()).updateKind(caller, input),
  listTasks: async (caller) => (await impl()).listTasks(caller),
  updateTask: async (caller, input) => (await impl()).updateTask(caller, input),
  listTaskModels: async () => (await impl()).listTaskModels(),
  getQuota: async (caller) => (await impl()).getQuota(caller),
  updateQuota: async (caller, input) =>
    (await impl()).updateQuota(caller, input),
};
