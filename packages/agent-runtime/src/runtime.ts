import type { ApprovalRequest, PendingMessageNotifier } from "@chia/agent-core";

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
  /**
   * Optional wake-up channel that shortens the pending-message wait from "up to one poll interval"
   * to "as fast as the channel delivers". Purely an accelerator — the poller below is what makes
   * delivery actually happen, so a missing or broken notifier costs latency and nothing else.
   */
  pendingNotifier?: PendingMessageNotifier;
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
    pendingNotifier,
  }: RunAgentTurnOptions<TCreateOptions, TApproval>) {
    const emit = createOptions.onEvent;
    let engine: THandle | undefined;
    let drainInterval: ReturnType<typeof setInterval> | undefined;
    let activeDrain: Promise<void> | undefined;
    let drainRequested = false;
    let notifierSubscription:
      | Promise<(() => Promise<void>) | undefined>
      | undefined;

    const stopDraining = async () => {
      if (drainInterval) {
        clearInterval(drainInterval);
        drainInterval = undefined;
      }
      if (notifierSubscription) {
        const subscription = notifierSubscription;
        notifierSubscription = undefined;
        // Detaching must not fail the turn — the channel is an accelerator, not a dependency.
        await (await subscription)?.().catch(() => undefined);
      }
      // A drain can schedule a follow-up drain (see `drain`), so one await is not enough: awaiting
      // the in-flight promise resumes only after its `finally` has already assigned the next one,
      // so this loop drains the chain to its end. Stopping early would dispose the engine out from
      // under a delivery still in flight.
      while (activeDrain) await activeDrain;
    };

    try {
      const turnEngine = await definition.createEngine(createOptions);
      engine = turnEngine;

      const drainPendingMessages = async () => {
        try {
          await turnEngine.drainPendingMessages();
        } catch {
          // A failed drain must not kill the turn. The engine releases whatever it could not
          // deliver back to the store, so the next drain — this turn's or the next turn's — picks
          // those messages up again.
        }
      };
      /**
       * At most one drain in flight, and never a lost wake-up.
       *
       * Coalescing onto the in-flight promise is not enough on its own: a notification that lands
       * *after* that drain already claimed its rows would see the new message neither now nor
       * until the next poll, which would throw away the whole point of the notifier. So a request
       * arriving mid-drain sets a flag and the drain re-runs when it settles.
       */
      const drain = (): Promise<void> => {
        if (activeDrain) {
          drainRequested = true;
          return activeDrain;
        }
        drainRequested = false;
        activeDrain = drainPendingMessages().finally(() => {
          activeDrain = undefined;
          if (drainRequested) void drain();
        });
        return activeDrain;
      };

      drainInterval = setInterval(() => {
        void drain();
      }, drainIntervalMs);

      /**
       * Subscribed without awaiting: the turn must not pay a network round trip before its first
       * token just to set up an optimisation. Teardown awaits this promise before unsubscribing,
       * and a rejection resolves to `undefined` — losing the accelerator only means falling back
       * to the poll interval.
       */
      notifierSubscription = pendingNotifier
        ?.subscribe(createOptions.agentSessionId, () => void drain())
        .catch(() => undefined);

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
