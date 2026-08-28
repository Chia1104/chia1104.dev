import type { AgentKindDefinition } from "@chia/agent-host/kind";

const definitions = new Map<
  string,
  Promise<AgentKindDefinition<unknown, object>>
>();

export const loadAgentKind = (
  kind: string
): Promise<AgentKindDefinition<unknown, object>> | undefined => {
  if (kind !== "writing") return undefined;
  let loading = definitions.get(kind);
  if (!loading) {
    loading = import("./writing").then((module) => module.writingAgentKind);
    loading.catch(() => definitions.delete(kind));
    definitions.set(kind, loading);
  }
  return loading;
};
