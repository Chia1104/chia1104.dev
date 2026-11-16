import { defineHook } from "workflow";

import { agentAbortPayloadSchema } from "./agent.schema";

/**
 * The abort hook a turn run races its step against. `defineHook` shares the payload type
 * between the workflow that awaits and the control route that resumes, and validates the
 * schema at the boundary. The token derives from the `agent.run` id, which the service holds
 * before the workflow run exists, so an abort needs no lookup.
 *
 * Imported from the workflow sandbox, so this module must stay free of Node built-ins.
 */

export const agentAbortHook = defineHook({ schema: agentAbortPayloadSchema });

export const agentAbortToken = (runId: string): string =>
  `agent:abort:${runId}`;
