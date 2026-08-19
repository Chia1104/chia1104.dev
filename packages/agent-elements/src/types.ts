import type { ContractRouterClient } from "@orpc/contract";

import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";
import type { agentContracts, routerContract } from "@chia/api/orpc/contracts";

/**
 * The transport every element talks through: the `agent` branch of the contract-typed oRPC client.
 * Each app hands in its own client (cookie session, API key, …); this package never builds one.
 */
export type AgentClient = ContractRouterClient<typeof routerContract>["agent"];

type SessionProcedures = AgentClient["sessions"];

/**
 * The procedures the session store and elements call, as plain signatures so a host passes
 * `client.agent` and a test passes a stub. Inputs are the contract's; outputs are the plain
 * shapes the store consumes (an event iterable, not oRPC's iterator class).
 */
export interface AgentSessionClient {
  sessions: {
    get: (
      input: Parameters<SessionProcedures["get"]>[0]
    ) => Promise<AgentSessionDetail>;
    chat: (
      input: Parameters<SessionProcedures["chat"]>[0],
      options?: { signal?: AbortSignal }
    ) => Promise<AsyncIterable<AgentWireEvent>>;
    abort: (
      input: Parameters<SessionProcedures["abort"]>[0]
    ) => Promise<Awaited<ReturnType<SessionProcedures["abort"]>>>;
    "settings:update": (
      input: Parameters<SessionProcedures["settings:update"]>[0]
    ) => Promise<AgentSessionDetail>;
  };
  models: {
    list: (
      input: Parameters<AgentClient["models"]["list"]>[0]
    ) => Promise<AgentModel[]>;
  };
}

export type AgentSessionDetail = agentContracts.AgentSessionDetail;
export type AgentSessionSummary = agentContracts.AgentSessionSummary;
export type AgentModel = Awaited<
  ReturnType<AgentClient["models"]["list"]>
>[number];
export type AgentThinkingLevel = NonNullable<
  AgentSessionDetail["settings"]
>["thinkingLevel"];
export interface AgentModelRef {
  providerId: string;
  modelId: string;
}
