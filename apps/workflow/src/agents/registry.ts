import type { AgentKindDefinition } from "@chia/agent-host/kind";

type LoadAgentKind = () => Promise<AgentKindDefinition<unknown, object>>;

/**
 * The kinds this process can execute. Which tier may use a kind is decided in `apps/service`
 * before a run starts; here a kind is only looked up by the string on its session row.
 */
const loaders = new Map<string, LoadAgentKind>([
  ["writing", () => import("./writing").then((m) => m.writingAgentKind)],
  ["public", () => import("./public").then((m) => m.publicAgentKind)],
]);

const definitions = new Map<
  string,
  Promise<AgentKindDefinition<unknown, object>>
>();

export const loadAgentKind = (
  kind: string
): Promise<AgentKindDefinition<unknown, object>> | undefined => {
  const load = loaders.get(kind);
  if (!load) return undefined;
  let loading = definitions.get(kind);
  if (!loading) {
    loading = load().then((definition) => {
      if (definition.kind !== kind) {
        throw new Error(
          `Agent kind "${kind}" loaded a definition for "${definition.kind}".`
        );
      }
      return definition;
    });
    loading.catch(() => definitions.delete(kind));
    definitions.set(kind, loading);
  }
  return loading;
};
