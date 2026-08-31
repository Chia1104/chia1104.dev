import type { AgentKindDefinition } from "@chia/agent-host/kind";
import {
  BYOK_PROVIDER_IDS,
  UnknownAgentModelError,
} from "@chia/agent-runtime/models";

import type { AgentServiceHost } from "../agent.factory";
import type { AgentKindService } from "../agent.service";

import { createAgentMaintenanceOperations } from "./maintenance";
import { createAgentSessionOperations } from "./session";
import { createAgentTurnOperations } from "./turn";

/**
 * Builds the transport-facing service shared by every registered agent kind.
 *
 * Session persistence and projection, durable turn control, and tree maintenance are separate
 * operation groups. This module composes them with the kind's model policy and capabilities; it
 * owns no mutable process state.
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

    /** Validates model policy and catalogue membership before settings are persisted. */
    validateModel(ref) {
      try {
        definition.models.assert(ref);
        return Promise.resolve(null);
      } catch (error) {
        return Promise.resolve(
          error instanceof UnknownAgentModelError
            ? error.message
            : `Could not validate model "${ref.modelId}".`
        );
      }
    },

    listModels(caller) {
      // Listing only needs key presence; plaintext credentials never enter this path.
      const registered = host.credentials.read(caller.context.headers);
      const configured = BYOK_PROVIDER_IDS.filter(
        (providerId) => registered?.[providerId]
      );
      return Promise.resolve(definition.models.list({ configured }));
    },

    listCapabilities() {
      return Promise.resolve(definition.capabilities());
    },
  };
};
