import * as z from "zod";

import type { JsonObject } from "@chia/utils/json";

export const AGENT_DELTA_NAMESPACE = "agent:deltas";
export const AGENT_TURN_KEY = "turn";

/**
 * Start cursors for a turn. Coarse stream and delta namespace are indexed independently;
 * replaying deltas from an earlier point re-appends text the client already holds.
 */
export interface AgentStreamPosition extends JsonObject {
  streamIndex: number;
  deltaStreamIndex: number;
}

export interface AgentTurnMarker extends AgentStreamPosition {
  seqBefore: number;
  running: boolean;
  /**
   * Set by the service when it claims the next turn ahead of resuming the hook; the step
   * overwrites the marker with `null`. A release names the claim it undoes, so a late
   * compensation cannot touch a turn the step has since started.
   */
  claimId: string | null;
}

const agentTurnMarkerSchema = z.object({
  seqBefore: z.number(),
  streamIndex: z.number(),
  deltaStreamIndex: z.number(),
  running: z.boolean(),
  claimId: z.string().nullable().default(null),
});

export const readAgentTurnMarker = (metadata: JsonObject) =>
  agentTurnMarkerSchema.safeParse(metadata[AGENT_TURN_KEY]).data;

export interface AgentAbortMessage {
  type: "abort";
  reason: string;
  expired: boolean;
}
