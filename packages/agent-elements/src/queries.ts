import { queryOptions } from "@tanstack/react-query";

import type { AgentSessionClient, AgentSessionDetail } from "./types.ts";

/**
 * Server state, as TanStack Query options. The session store reads and refreshes the detail
 * through the same options (`fetchQuery` / `invalidateQueries`), so the cache is the one copy
 * both the store and the elements see; only the live turn stream lives outside it.
 */

export interface AgentSessionScope {
  sessionId: string;
  kind?: string;
}

export const agentQueryKeys = {
  all: ["agent-elements"] as const,
  session: (sessionId: string) =>
    [...agentQueryKeys.all, "session", sessionId] as const,
  models: (kind: string) => [...agentQueryKeys.all, "models", kind] as const,
};

/**
 * `staleTime: Infinity` — the store decides when the detail is refetched (turn end, state
 * change, resync); observers only subscribe. Otherwise a window focus mid-turn would refetch a
 * transcript cut at the running turn.
 */
export const sessionDetailQuery = (
  client: AgentSessionClient,
  scope: AgentSessionScope
) =>
  queryOptions<AgentSessionDetail>({
    queryKey: agentQueryKeys.session(scope.sessionId),
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
