import type { ApprovalRequest } from "@chia/agent-core";

import type {
  AgentDefinition,
  AgentEngineCreateOptions,
  AgentEngineHandle,
  AgentMaintenanceCreateOptions,
  AgentMaintenanceEngineHandle,
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
  /** Present only when the definition supplies one; see `AgentDefinition.createMaintenanceEngine`. */
  createMaintenanceEngine?: (
    options: AgentMaintenanceCreateOptions
  ) => Promise<AgentMaintenanceEngineHandle>;
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
  createMaintenanceEngine: definition.createMaintenanceEngine,
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
    let activeDrain: Promise<void> | undefined;

    const stopDraining = async () => {
      if (drainInterval) {
        clearInterval(drainInterval);
        drainInterval = undefined;
      }
      await activeDrain;
    };

    try {
      const turnEngine = await definition.createEngine(createOptions);
      engine = turnEngine;

      const drainPendingMessages = async () => {
        try {
          await turnEngine.drainPendingMessages();
        } catch {
          // A failed drain must not kill the turn; a durable store leaves it queued for retry.
        }
      };
      const drain = () => {
        if (!activeDrain) {
          activeDrain = drainPendingMessages().finally(() => {
            activeDrain = undefined;
          });
        }
        return activeDrain;
      };

      drainInterval = setInterval(() => {
        void drain();
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
          await turnEngine.promptFromTemplate(
            message.template.name,
            message.template.args
          );
        } else {
          await turnEngine.prompt(message.text);
        }
      } catch (error) {
        failure = messageFor(error);
      } finally {
        await stopDraining();
      }

      const approvals: TApproval[] = [];
      for (const request of turnEngine.approvalRequests) {
        const approval = toApproval(request);
        approvals.push(approval);
        await persistApproval(approval);
      }

      /**
       * Auto-compaction, at the one moment it is safe and cheap.
       *
       * Both guards are load-bearing. A turn parked on an approval must keep its tree still: the
       * compaction horizon would otherwise move out from under the run that resumes hours later,
       * which is the same reason the service refuses a manual compact while a turn is live. And a
       * failed turn keeps its history, because a compacted transcript cannot be diagnosed.
       *
       * After the turn, not before it: the user never waits on a summarisation call to see their
       * first token, and the assistant message that just landed carries the provider's own usage,
       * which is the most accurate signal the engine will ever have.
       */
      if (!failure && approvals.length === 0) {
        try {
          await turnEngine.compactIfNeeded?.();
        } catch {
          // Compaction must never take the turn down with it; the next turn boundary retries.
          // Same posture as the pending-message drain above.
        }
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
      await stopDraining();
      try {
        engine?.dispose();
      } finally {
        await flushEvents?.();
      }
    }
  },
});
