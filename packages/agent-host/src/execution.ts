import * as z from "zod";

import type { JsonObject } from "@chia/utils/json";

export const AGENT_DELTA_NAMESPACE = "agent:deltas";
export const AGENT_TURN_KEY = "turn";

/**
 * Where a turn begins on the run's durable streams. The coarse stream and the delta namespace
 * are indexed independently, so a turn needs a cursor into each; replaying deltas from any
 * earlier point re-appends text to messages the client already holds.
 */
export interface AgentStreamPosition extends JsonObject {
  streamIndex: number;
  deltaStreamIndex: number;
}

export interface AgentTurnMarker extends AgentStreamPosition {
  seqBefore: number;
  running: boolean;
}

const agentTurnMarkerSchema = z.object({
  seqBefore: z.number(),
  streamIndex: z.number(),
  deltaStreamIndex: z.number(),
  running: z.boolean(),
});

export const readAgentTurnMarker = (metadata: JsonObject) =>
  agentTurnMarkerSchema.safeParse(metadata[AGENT_TURN_KEY]).data;

export interface AgentAbortMessage {
  type: "abort";
  reason: string;
  expired: boolean;
}
