"use client";

import { useQuery } from "@tanstack/react-query";

import { agentUsageQuery } from "./queries.ts";
import type { AgentSessionClient, AgentUsageStanding } from "./types.ts";

/**
 * Takes the client directly because standing is per caller and a host may show it before any
 * session is mounted (an empty chat, a sign-in gate).
 */
export const useAgentUsage = (client: AgentSessionClient) =>
  useQuery(agentUsageQuery(client));

/** Fraction of the allowance spent, clamped to `[0, 1]`; `null` when the caller is exempt. */
export const usageFractionOf = (
  standing: Pick<AgentUsageStanding, "limitMicros" | "usedMicros">
): number | null => {
  if (standing.limitMicros === null || standing.limitMicros <= 0) return null;
  return Math.min(1, Math.max(0, standing.usedMicros / standing.limitMicros));
};

export const isQuotaExhausted = (
  standing: Pick<AgentUsageStanding, "limitMicros" | "usedMicros">
): boolean =>
  standing.limitMicros !== null && standing.usedMicros >= standing.limitMicros;
