import { assertAgentKind } from "@chia/agent-host/kind";
import type { AgentKindDefinition } from "@chia/agent-host/kind";

/**
 * Execution-side factory. Which tier may use a kind is decided in `apps/service` before a run
 * starts; here a kind is only looked up by the string on its session row. Dynamic imports cache
 * their modules; no definition Map is needed.
 */
export const agentFactory = {
  async load(
    kind: string
  ): Promise<AgentKindDefinition<unknown, object> | undefined> {
    switch (kind) {
      case "writing":
        return assertAgentKind(
          kind,
          await import("./writing").then((module) => module.writingAgentKind)
        );
      case "public":
        return assertAgentKind(
          kind,
          await import("./public").then((module) => module.publicAgentKind)
        );
      default:
        return undefined;
    }
  },
};
