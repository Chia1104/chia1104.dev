import { queryOptions } from "@tanstack/react-query";

import type { AgentSessionClient, AgentSessionDetail } from "./types.ts";

/**
 * The session store reads and refreshes detail through these options, so the cache is the one
 * copy both the store and the elements see. Only the live turn stream lives outside it.
 */

export interface AgentSessionScope {
  sessionId: string;
  kind?: string;
}

export const agentQueryKeys = {
  all: ["agent-elements"] as const,
  session: (scope: AgentSessionScope) =>
    [...agentQueryKeys.all, "session", scope.sessionId, scope.kind] as const,
  models: (kind: string) => [...agentQueryKeys.all, "models", kind] as const,
  capabilities: (kind: string) =>
    [...agentQueryKeys.all, "capabilities", kind] as const,
  /** Per caller, not per session: one standing covers every session they own. */
  usage: () => [...agentQueryKeys.all, "usage"] as const,
};

/**
 * `staleTime: Infinity`: the store decides when the detail is refetched. Otherwise a window
 * focus mid-turn would refetch a transcript cut at the running turn.
 */
export const sessionDetailQuery = (
  client: AgentSessionClient,
  scope: AgentSessionScope
) =>
  queryOptions<AgentSessionDetail>({
    queryKey: agentQueryKeys.session(scope),
    queryFn: () => client.sessions.get(scope),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });

export const agentModelsQuery = (client: AgentSessionClient, kind: string) =>
  queryOptions({
    queryKey: agentQueryKeys.models(kind),
    queryFn: () => client.models.list({ kind }),
    staleTime: 5 * 60_000,
  });

export const agentCapabilitiesQuery = (
  client: AgentSessionClient,
  kind: string
) =>
  queryOptions({
    queryKey: agentQueryKeys.capabilities(kind),
    queryFn: () => client.capabilities.list({ kind }),
    staleTime: 5 * 60_000,
  });

/**
 * Spend moves only when a turn ends, so the host invalidates this from `onTurnEnd` rather than
 * polling; a short `staleTime` still catches a turn finished in another tab.
 */
export const agentUsageQuery = (client: AgentSessionClient) =>
  queryOptions({
    queryKey: agentQueryKeys.usage(),
    queryFn: () => client.usage.me(),
    staleTime: 30_000,
  });
