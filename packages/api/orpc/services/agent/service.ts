import { loadKindConfig } from "@chia/agent-host/config";
import type { AgentKindDefinition } from "@chia/agent-host/kind";
import { accessOf, UnknownAgentModelError } from "@chia/agent-runtime/models";

import type { AgentServiceHost } from "../agent.factory";
import type { AgentKindService } from "../agent.service";

import { createAgentMaintenanceOperations } from "./maintenance";
import { createAgentSessionOperations } from "./session";
import { createAgentTurnOperations } from "./turn";

/**
 * Session persistence, durable turn control, and tree maintenance are separate operation
 * groups. This module composes them with the kind's model policy; it owns no mutable process
 * state.
 */
export const createAgentKindService = <TState, TConfig extends object>(
  definition: AgentKindDefinition<TState, TConfig>,
  host: AgentServiceHost
): AgentKindService => {
  const sessions = createAgentSessionOperations(definition, host);

  return {
    ...sessions.service,
    ...createAgentTurnOperations(definition, sessions, host),
    ...createAgentMaintenanceOperations(definition, sessions, host),

    /** Validates model policy and catalogue membership for this caller before settings are persisted. */
    async validateModel(caller, ref) {
      const { defaults } = await loadKindConfig(caller.context.db, definition);
      try {
        definition.models.assert(
          ref,
          accessOf(host.credentials.read(caller.context.headers)),
          defaults
        );
        return null;
      } catch (error) {
        return error instanceof UnknownAgentModelError
          ? error.message
          : `Could not validate model "${ref.modelId}".`;
      }
    },

    async listModels(caller) {
      // Listing only needs key presence; plaintext credentials never enter this path.
      const { defaults } = await loadKindConfig(caller.context.db, definition);
      return definition.models.list(
        accessOf(host.credentials.read(caller.context.headers)),
        defaults
      );
    },

    listCapabilities() {
      return Promise.resolve(definition.capabilities());
    },
  };
};
