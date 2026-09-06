import {
  AGENT_TURN_KEY,
  readAgentTurnMarker,
} from "@chia/agent-host/execution";
import type {
  AgentStreamPosition,
  AgentTurnMarker,
} from "@chia/agent-host/execution";
import type { AgentKindDefinition } from "@chia/agent-host/kind";
import {
  assertBelowRunningTurnCap,
  assertWithinAgentQuota,
} from "@chia/agent-host/quota";
import { formatOperatorDecision } from "@chia/agent-runtime/wire/operator-decision";
import type { DB } from "@chia/db/client";
import {
  bindAgentRunExternalId,
  completeAgentRun,
  createAgentRun,
  decideAgentApproval,
  getAgentApproval,
  getAgentRun,
  getAgentSessionLastSeq,
  setAgentApprovalRelayRun,
  withAgentSessionLock,
} from "@chia/db/repos/agent";
import type { AgentRunStatus } from "@chia/db/schema";
import { AppError, isAppError } from "@chia/service-kit/errors";
import type { AppErrorCode } from "@chia/service-kit/errors";
import type { JsonObject } from "@chia/utils/json";
import type { AgentAbortControllerRef } from "@chia/workflow-control/agent-hooks";
import type {
  AgentMessagePayload,
  WorkflowControlClient,
} from "@chia/workflow-control/client";

import type { AgentServiceHost } from "../agent.factory";
import type {
  AgentKindService,
  AgentServiceCaller,
  AgentStreamCursor,
} from "../agent.service";

import {
  AGENT_ABORT_CONTROLLER_KEY,
  signalAgentAbort,
  startAgentAbortController,
} from "./abort";
import {
  agentStreamCursor,
  cancelLiveAgentRun,
  streamAgentRunEvents,
  waitForAgentTurnEnd,
} from "./run-control";
import {
  isRunLease,
  isRunLive,
  reconcileRunningAgentTurns,
  runStateOf,
} from "./run-liveness";
import type { AgentSessionOperations } from "./session";

type TurnService = Pick<
  AgentKindService,
  "prompt" | "attach" | "stream" | "abort" | "approve"
>;

type OwnedSession<TState, TConfig extends object> = NonNullable<
  Awaited<
    ReturnType<AgentSessionOperations<TState, TConfig>["loadOwnedSession"]>
  >
>;

/**
 * What the lock transaction accepted: a run row written as the session's lease, to be bound
 * to the workflow run once it exists. Delivery happens after the commit, because a workflow
 * command cannot be rolled back and the row is the record of what was accepted.
 */
interface AcceptedTurn {
  runId: string;
  abortController: AgentAbortControllerRef;
  position: AgentStreamPosition;
  message: AgentMessagePayload;
  /** A live run of the session that was not executing a turn; cancelled once replaced. */
  staleWorkflowRunId: string | null;
}

/** An operator's decision as the approval row records it. */
interface RecordedDecision {
  approved: boolean;
  comment?: string;
}

type AdmitTurn<TState, TConfig extends object> = (
  tx: DB,
  caller: AgentServiceCaller,
  row: OwnedSession<TState, TConfig>
) => Promise<{
  message: AgentMessagePayload;
  bind?: (tx: DB, runId: string) => Promise<void>;
} | null>;

/**
 * A relay run that never reached the model: closed without the executor ever claiming it,
 * whether refused by the workflow service or closed by reconciliation or the operator first.
 * A turn that ran and then failed or was aborted carries the claim; a lease whose fate is
 * unknown is still `active`.
 */
const relayNeverRan = (run: {
  status: AgentRunStatus;
  metadata: JsonObject;
}): boolean =>
  (run.status === "failed" || run.status === "cancelled") &&
  readAgentTurnMarker(run.metadata)?.claimed !== true;

/**
 * Whether the workflow service rejected the command before executing it. Only then is it
 * known that no run started; a timeout, a dropped response or a failure inside the service
 * may have started one, and the lease row must stay until the executor claims it or its
 * TTL passes.
 */
const deliveryRefused = (code: AppErrorCode | null): boolean =>
  code === "BAD_REQUEST" ||
  code === "UNAUTHORIZED" ||
  code === "FORBIDDEN" ||
  code === "UNPROCESSABLE_CONTENT";

/** Durable turn admission and live transport for one agent kind. */
export const createAgentTurnOperations = <TState, TConfig extends object>(
  definition: AgentKindDefinition<TState, TConfig>,
  sessions: AgentSessionOperations<TState, TConfig>,
  host: AgentServiceHost
): TurnService => {
  /** Every model-producing continuation goes through the same admission policy in this order. */
  const assertCanStartTurn = async (
    db: DB,
    caller: AgentServiceCaller
  ): Promise<void> => {
    await assertWithinAgentQuota(db, caller);
    await reconcileRunningAgentTurns(
      db,
      host.runs,
      caller.context.workflow,
      caller.userId
    );
    await assertBelowRunningTurnCap(db, caller);
  };

  /**
   * A workflow that started while its row still carries the lease id, so `abort` could not
   * find it. Stops it on the id only this request holds, and fails the row only once the turn
   * was seen to end; otherwise the lease keeps the session blocked and the turn step binds the
   * real id, so the operator's abort can finish the job.
   */
  const settleUnboundRun = async (
    db: DB,
    workflow: WorkflowControlClient,
    sessionId: string,
    runId: string,
    workflowRunId: string,
    abortController: AgentAbortControllerRef,
    cause: unknown
  ) => {
    const signalled = await signalAgentAbort(
      workflow,
      abortController.id,
      "run failed to bind"
    );
    const ended =
      signalled && (await waitForAgentTurnEnd(host.runs, workflowRunId, 0));
    if (ended) {
      await cancelLiveAgentRun(host.runs, workflow, workflowRunId).catch(
        () => undefined
      );
      await completeAgentRun(db, runId, "failed").catch(() => undefined);
    }
    console.error("Agent run could not be bound to its workflow run", {
      sessionId,
      runId,
      workflowRunId,
      stopped: ended,
      cause,
    });
  };

  /**
   * The lock transaction: the checks `admit` makes, the run row as the session's lease, and
   * `bind` once that row exists. `null` when there is nothing to start.
   */
  const admitTurn = async (
    outer: AgentServiceCaller,
    sessionId: string,
    abortController: AgentAbortControllerRef,
    admit: AdmitTurn<TState, TConfig>
  ): Promise<AcceptedTurn | null> =>
    withAgentSessionLock(
      outer.context.db,
      sessionId,
      async (tx): Promise<AcceptedTurn | null> => {
        const caller = sessions.withDb(outer, tx);
        const row = await sessions.loadOwnedSession(caller, sessionId);
        // The guard resolved the session already; a miss under the lock means it was just deleted.
        if (!row) {
          throw new AppError("NOT_FOUND", {
            message: `Unknown agent session: ${sessionId}`,
          });
        }

        const admitted = await admit(tx, caller, row);
        if (!admitted) return null;
        const { message } = admitted;

        // One turn at a time: quota and the running cap were checked here, and a turn run
        // behind this one would execute after its cost landed without being checked again.
        const state = await runStateOf(host.runs, row);
        if (state?.status === "running") {
          throw new AppError("CONFLICT", {
            message:
              "A turn is still running. Wait for it to finish or stop it before sending another message.",
          });
        }

        const runId = crypto.randomUUID();
        const position: AgentStreamPosition = {
          streamIndex: 0,
          deltaStreamIndex: 0,
        };
        const turn: AgentTurnMarker = {
          seqBefore: await getAgentSessionLastSeq(tx, row.id),
          ...position,
          running: true,
          claimed: false,
        };
        await createAgentRun(tx, {
          id: runId,
          sessionId,
          harnessKind: "workflow",
          externalRunId: runId,
          metadata: {
            agentKind: definition.kind,
            [AGENT_TURN_KEY]: turn,
            [AGENT_ABORT_CONTROLLER_KEY]: {
              id: abortController.id,
              runId: abortController.runId,
            },
          },
        });
        await admitted.bind?.(tx, runId);
        return {
          runId,
          abortController,
          position,
          message,
          staleWorkflowRunId: state ? row.workflowRunId : null,
        };
      }
    );

  /**
   * Writes the run row under the session lock, then starts the run. `admit` runs inside the
   * lock and returns the turn's message, or `null` when there is nothing to start; `bind`
   * runs in the same transaction once the run row exists.
   */
  const startTurn = async (
    outer: AgentServiceCaller,
    sessionId: string,
    admit: AdmitTurn<TState, TConfig>
  ): Promise<AgentStreamCursor | null> => {
    const db = outer.context.db;
    const workflow = outer.context.workflow;
    // Started before the lock: a remote call must not hold the session's advisory lock and a
    // pool connection for its timeout. An admission that then refuses closes it again.
    const abortController = await startAgentAbortController(workflow);
    let accepted: AcceptedTurn | null;
    try {
      accepted = await admitTurn(outer, sessionId, abortController, admit);
    } catch (error) {
      await signalAgentAbort(workflow, abortController.id, "admission refused");
      throw error;
    }
    if (!accepted) {
      await signalAgentAbort(workflow, abortController.id, "nothing to start");
      return null;
    }

    // The row it drove is closed by `createAgentRun`; the run itself would otherwise sit in
    // the World until it ends on its own.
    if (accepted.staleWorkflowRunId) {
      await cancelLiveAgentRun(
        host.runs,
        workflow,
        accepted.staleWorkflowRunId
      ).catch(() => undefined);
    }

    let workflowRunId;
    try {
      workflowRunId = await workflow.startAgentSession({
        sessionId,
        runId: accepted.runId,
        userId: outer.userId,
        abortController: accepted.abortController,
        message: accepted.message,
      });
    } catch (error) {
      const code = isAppError(error) ? error.code : null;
      if (deliveryRefused(code)) {
        await completeAgentRun(db, accepted.runId, "failed");
        await signalAgentAbort(
          workflow,
          accepted.abortController.id,
          "run failed to start"
        );
      } else {
        // The workflow may have started. The lease row keeps the session blocked; the turn
        // step binds the real run id onto it, after which abort and reconcile see the run,
        // and an unbound lease is closed once its TTL passes.
        console.error("Agent run start is unresolved; the lease is kept", {
          sessionId,
          runId: accepted.runId,
          code,
        });
      }
      throw error;
    }
    try {
      await bindAgentRunExternalId(db, accepted.runId, workflowRunId);
    } catch (error) {
      await settleUnboundRun(
        db,
        workflow,
        sessionId,
        accepted.runId,
        workflowRunId,
        accepted.abortController,
        error
      );
      throw error;
    }
    return agentStreamCursor(workflowRunId, accepted.position);
  };

  return {
    /** Accepts a message under the session lock, then starts its durable run. */
    async prompt(outer, input) {
      const cursor = await startTurn(
        outer,
        input.sessionId,
        async (tx, caller) => {
          await assertCanStartTurn(tx, caller);

          // Admitted before the run starts, so a bad attachment fails this request rather
          // than the turn.
          if (input.attachments && input.attachments.length > 0) {
            if (!definition.state.attach) {
              throw new AppError("BAD_REQUEST", {
                message: `Agent kind "${definition.kind}" takes no attachments.`,
              });
            }
            await definition.state.attach(
              caller,
              tx,
              input.sessionId,
              input.attachments
            );
          }

          const outstanding = await sessions.undecidedApprovals(
            tx,
            input.sessionId
          );
          if (outstanding.length > 0) {
            throw new AppError("CONFLICT", {
              message: `Waiting on your decision for \`${outstanding.join("`, `")}\`. Approve or reject it before sending another message.`,
            });
          }

          return {
            message: {
              text: input.text,
              template: input.template,
              attachments: input.attachments,
              credentials: host.credentials.read(caller.context.headers),
            },
          };
        }
      );
      if (!cursor) {
        throw new AppError("NOT_FOUND", {
          message: `Unknown agent session: ${input.sessionId}`,
        });
      }
      return { ...cursor, startedRun: true };
    },

    async attach(caller, input) {
      const row = await sessions.loadOwnedSession(caller, input.sessionId);
      if (!row?.workflowRunId || !row.turn || isRunLease(row)) return null;
      const run = await runStateOf(host.runs, row);
      return run?.status === "running"
        ? agentStreamCursor(row.workflowRunId, row.turn)
        : null;
    },

    async *stream(caller, input) {
      const row = await sessions.loadOwnedSession(caller, input.sessionId);
      if (!row) {
        throw new AppError("NOT_FOUND", {
          message: `Unknown agent session: ${input.sessionId}`,
        });
      }

      const runId = input.runId ?? row.workflowRunId;
      if (!runId) return;
      yield* streamAgentRunEvents({
        runs: host.runs,
        runId,
        startIndex: input.startIndex,
        deltaStartIndex: input.deltaStartIndex,
      });
    },

    async abort(caller, input) {
      const row = await sessions.loadOwnedSession(caller, input.sessionId);
      if (
        !row?.workflowRunId ||
        !(await isRunLive(host.runs, row.workflowRunId))
      ) {
        return false;
      }

      if (row.abortController) {
        const signalled = await signalAgentAbort(
          caller.context.workflow,
          row.abortController.id,
          "stopped by the operator"
        );
        if (signalled && row.turn?.running) {
          await waitForAgentTurnEnd(
            host.runs,
            row.workflowRunId,
            row.turn.streamIndex
          );
        }
      }
      await cancelLiveAgentRun(
        host.runs,
        caller.context.workflow,
        row.workflowRunId
      );
      if (row.activeRunId) {
        await completeAgentRun(caller.context.db, row.activeRunId, "cancelled");
      }
      return true;
    },

    /**
     * Records the decision on the pending request and starts the run that relays it. A
     * decision is written once. A request already decided is delivered again only when its
     * relay run never executed: the recorded decision, whatever this call says. A relay run
     * that ran, or whose fate is still unknown, starts nothing.
     */
    approve: (outer, input) =>
      startTurn(outer, input.sessionId, async (tx, caller) => {
        const existing = await getAgentApproval(
          tx,
          input.sessionId,
          input.toolCallId
        );
        if (!existing) return null;

        let decision: RecordedDecision;
        if (existing.status === "pending") {
          await assertCanStartTurn(tx, caller);
          const decided = await decideAgentApproval(tx, {
            sessionId: input.sessionId,
            toolCallId: input.toolCallId,
            approved: input.approved,
            comment: input.comment,
            decidedBy: caller.userId,
          });
          if (!decided) return null;
          decision = { approved: input.approved, comment: input.comment };
        } else {
          const relay = existing.relayRunId
            ? await getAgentRun(tx, existing.relayRunId)
            : null;
          if (!relay || !relayNeverRan(relay)) return null;
          await assertCanStartTurn(tx, caller);
          decision = {
            approved: existing.status === "approved",
            comment: existing.comment ?? undefined,
          };
        }

        const relayed = {
          toolCallId: existing.toolCallId,
          toolName: existing.toolName,
          ...decision,
        };
        return {
          message: {
            text: formatOperatorDecision(relayed),
            decision: relayed,
            credentials: host.credentials.read(caller.context.headers),
          },
          bind: (db, runId) =>
            setAgentApprovalRelayRun(db, {
              sessionId: input.sessionId,
              toolCallId: input.toolCallId,
              relayRunId: runId,
            }),
        };
      }),
  };
};
