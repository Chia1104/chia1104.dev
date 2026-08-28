import * as z from "zod";

import type { JsonObject } from "@chia/utils/json";

export const AGENT_DELTA_NAMESPACE = "agent:deltas";
export const AGENT_TURN_KEY = "turn";

export interface AgentTurnMarker extends JsonObject {
  seqBefore: number;
  streamIndex: number;
  running: boolean;
}

const agentTurnMarkerSchema = z.object({
  seqBefore: z.number(),
  streamIndex: z.number(),
  running: z.boolean(),
});

export const readAgentTurnMarker = (metadata: JsonObject) =>
  agentTurnMarkerSchema.safeParse(metadata[AGENT_TURN_KEY]).data;

export interface AgentAbortMessage {
  type: "abort";
  reason: string;
  expired: boolean;
}
