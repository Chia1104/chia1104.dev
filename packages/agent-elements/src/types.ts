import type { RouterContractClient } from "@orpc/contract";

import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";
import type {
  AgentSessionDetail as ContractAgentSessionDetail,
  AgentSessionSummary as ContractAgentSessionSummary,
  AgentUsageStanding as ContractAgentUsageStanding,
} from "@chia/services/agent/agent.contract";
import type { routerContract } from "@chia/services/router.contract";

/**
 * The `agent` branch of the host's contract-typed oRPC client. This package never builds one.
 */
export type AgentClient = RouterContractClient<typeof routerContract>["agent"];

type SessionProcedures = AgentClient["sessions"];
type CapabilityProcedures = AgentClient["capabilities"];

/**
 * Plain signatures so a host passes `client.agent` and a test passes a stub. Outputs are the
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
    compact: (
      input: Parameters<SessionProcedures["compact"]>[0]
    ) => Promise<AgentSessionDetail>;
    navigate: (
      input: Parameters<SessionProcedures["navigate"]>[0]
    ) => Promise<AgentSessionDetail>;
    fork: (
      input: Parameters<SessionProcedures["fork"]>[0]
    ) => Promise<AgentSessionDetail>;
  };
  models: {
    list: (
      input: Parameters<AgentClient["models"]["list"]>[0]
    ) => Promise<AgentModel[]>;
  };
  capabilities: {
    list: (
      input: Parameters<CapabilityProcedures["list"]>[0]
    ) => Promise<AgentCapabilities>;
  };
  usage: {
    me: () => Promise<AgentUsageStanding>;
  };
}

export type AgentSessionDetail = ContractAgentSessionDetail;
export type AgentSessionSummary = ContractAgentSessionSummary;
export type AgentUsageStanding = ContractAgentUsageStanding;
export type AgentModel = Awaited<
  ReturnType<AgentClient["models"]["list"]>
>[number];
export type AgentCapabilities = Awaited<
  ReturnType<CapabilityProcedures["list"]>
>;
export type AgentThinkingLevel =
  AgentSessionDetail["settings"]["thinkingLevel"];
export interface AgentModelRef {
  providerId: string;
  modelId: string;
}
