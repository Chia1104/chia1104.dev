import type { ApprovalRequest } from "@chia/agent-core";

import type {
  AgentDefinition,
  AgentEngineCreateOptions,
  AgentEngineHandle,
} from "./engine.ts";

const DEFAULT_DRAIN_INTERVAL_MS = 1_000;

export interface AgentTurnMessage {
  text: string;
  template?: { name: string; args?: string[] };
}

export interface AgentTurnExecution<TApproval> {
  status: "done" | "awaiting_approval" | "error";
  approvals: TApproval[];
  error?: string;
}

export interface RunAgentTurnOptions<
  TCreateOptions extends AgentEngineCreateOptions,
  TApproval,
> {
  createOptions: TCreateOptions;
  message: AgentTurnMessage;
  toApproval: (request: ApprovalRequest) => TApproval;
  persistApproval: (approval: TApproval) => Promise<void>;
  /**
   * Flushes the transport sink after the engine is disposed. Workflow-backed callers use this to
   * await and release stream writers; in-memory callers can omit it.
   */
  flushEvents?: () => Promise<void>;
  drainIntervalMs?: number;
}

export interface AgentRuntimeFactory<
  TCreateOptions extends AgentEngineCreateOptions,
  THandle extends AgentEngineHandle,
> {
  kind: string;
  createEngine: (options: TCreateOptions) => Promise<THandle>;
  runTurn: <TApproval>(
    options: RunAgentTurnOptions<TCreateOptions, TApproval>
  ) => Promise<AgentTurnExecution<TApproval>>;
}

const messageFor = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * Creates the reusable runtime operations for an agent definition.
 *
 * Durable orchestration deliberately stays outside this function: hooks and workflow loops must
 * only pass serializable data. This factory runs inside a normal server function or a workflow
 * step, where provider SDKs, database handles, and timers are available.
 */
export const createAgentRuntime = <
  TCreateOptions extends AgentEngineCreateOptions,
  THandle extends AgentEngineHandle,
>(
  definition: AgentDefinition<TCreateOptions, THandle>
): AgentRuntimeFactory<TCreateOptions, THandle> => ({
  kind: definition.kind,
  createEngine: definition.createEngine,
  async runTurn<TApproval>({
    createOptions,
    message,
    toApproval,
    persistApproval,
    flushEvents,
    drainIntervalMs = DEFAULT_DRAIN_INTERVAL_MS,
  }: RunAgentTurnOptions<TCreateOptions, TApproval>) {
    const emit = createOptions.onEvent;
    let engine: THandle | undefined;
    let drainInterval: ReturnType<typeof setInterval> | undefined;

    try {
      engine = await definition.createEngine(createOptions);
      drainInterval = setInterval(() => {
        void engine?.drainPendingMessages().catch(() => {
          // A failed drain must not kill the turn; a durable store leaves it queued for retry.
        });
      }, drainIntervalMs);

      emit({ type: "run:start", sessionId: createOptions.agentSessionId });
      const now = Date.now();
      emit({
        type: "user",
        messageId: `u-${now.toString(36)}`,
        text: message.text,
      });

      let failure: string | undefined;
      try {
        if (message.template) {
          await engine.promptFromTemplate(
            message.template.name,
            message.template.args
          );
        } else {
          await engine.prompt(message.text);
        }
      } catch (error) {
        failure = messageFor(error);
      } finally {
        clearInterval(drainInterval);
        drainInterval = undefined;
      }

      const approvals: TApproval[] = [];
      for (const request of engine.approvalRequests) {
        const approval = toApproval(request);
        approvals.push(approval);
        await persistApproval(approval);
      }

      if (failure) emit({ type: "error", message: failure });

      const status: AgentTurnExecution<TApproval>["status"] = failure
        ? "error"
        : approvals.length > 0
          ? "awaiting_approval"
          : "done";

      emit({
        type: "run:end",
        reason: status === "awaiting_approval" ? "awaiting_approval" : status,
      });

      return { status, approvals, error: failure };
    } finally {
      if (drainInterval) clearInterval(drainInterval);
      try {
        engine?.dispose();
      } finally {
        await flushEvents?.();
      }
    }
  },
});
