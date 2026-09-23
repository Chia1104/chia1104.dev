import { defineHook } from "workflow";

import { agentAbortPayloadSchema } from "./agent.schema";

/**
 * The abort hook a turn run parks on. `defineHook` shares the payload type between the
 * workflow that awaits and the API route that resumes, and validates the schema at the
 * boundary. Tokens are deterministic so a request that only holds the controller id can
 * reconstruct them without a lookup. `resumeHook` is server-side only and the route sits
 * behind `adminGuard`.
 *
 * Imported from the workflow sandbox, so this module must stay free of Node built-ins.
 */

export const agentAbortHook = defineHook({ schema: agentAbortPayloadSchema });

export const agentAbortToken = (controllerId: string): string =>
  `agent:abort:${controllerId}`;
