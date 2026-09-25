import {
  AGENT_TURN_KEY,
  readAgentTurnMarker,
} from "@chia/agent-host/execution";
import type {
  AgentStreamPosition,
  AgentTurnMarker,
} from "@chia/agent-host/execution";
import type {
  AgentKindDefinition,
  AgentKindState,
} from "@chia/agent-host/kind";
import {
  assertBelowRunningTurnCap,
  assertWithinAgentQuota,
} from "@chia/agent-host/quota";
import type { DB } from "@chia/db/client";
import {
  bindAgentRunExternalId,
  completeAgentRun,
  createAgentRun,
  decideAgentApproval,
  getAgentApproval,
  getAgentApprovalBatch,
  getAgentRun,
  getAgentSessionLastSeq,
  setAgentApprovalRelayRun,
  withAgentSessionLock,
} from "@chia/db/repos/agent";
import { AgentApprovalStatus, AgentRunStatus } from "@chia/db/schema";
import { logger } from "@chia/observability/logger";
import { reportError } from "@chia/observability/report";
import { AppError, AppErrorCode, isAppError } from "@chia/service-kit/errors";
import type { JsonObject } from "@chia/utils/json";
import type {
  AgentAbortControllerRef,
  AgentMessagePayload,
} from "@chia/workflow-control/agent-schema";
import type { WorkflowControlClient } from "@chia/workflow-control/client";

import {
  AGENT_ABORT_CONTROLLER_KEY,
  signalAgentAbort,
  startAgentAbortController,
} from "./abort";
import { AgentRunState } from "./agent.contract";
import type { AgentServiceHost } from "./agent.factory";
import type {
  AgentKindService,
  AgentServiceCaller,
  AgentStreamCursor,
} from "./agent.service";
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

type AdmitTurn<TState, TConfig extends object> = (
  tx: DB,
  caller: AgentServiceCaller,
  row: OwnedSession<TState, TConfig>
) => Promise<{
  message: AgentMessagePayload;
  bind?: (tx: DB, runId: string) => Promise<void>;
} | null>;

/**
 * A resuming run that never reached the model: closed without the executor ever claiming it,
 * whether refused by the workflow service or closed by reconciliation or the operator first.
 * A turn that ran and then failed or was aborted carries the claim; a lease whose fate is
 * unknown is still `active`.
 */
const relayNeverRan = (run: {
  status: AgentRunStatus;
  metadata: JsonObject;
}): boolean =>
  (run.status === AgentRunStatus.Failed ||
    run.status === AgentRunStatus.Cancelled) &&
  readAgentTurnMarker(run.metadata)?.claimed !== true;

/**
 * Whether the workflow service rejected the command before executing it. Only then is it
 * known that no run started; a timeout, a dropped response or a failure inside the service
 * may have started one, and the lease row must stay until the executor claims it or its
 * TTL passes.
 */
const deliveryRefused = (code: AppErrorCode | null): boolean =>
  code === AppErrorCode.BadRequest ||
  code === AppErrorCode.Unauthorized ||
  code === AppErrorCode.Forbidden ||
  code === AppErrorCode.UnprocessableContent;

/** Durable turn admission and live transport for one agent kind. */
export const createAgentTurnOperations = <TState, TConfig extends object>(
  definition: Pick<AgentKindDefinition<TState, TConfig>, "kind"> & {
    state: Pick<AgentKindState<TState>, "attach">;
  },
  sessions: Pick<
    AgentSessionOperations<TState, TConfig>,
    "withDb" | "loadOwnedSession" | "undecidedApprovals"
  >,
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
        (cause) =>
          reportError(cause, "Unbound agent run could not be cancelled", {
            sessionId,
            runId,
            workflowRunId,
          })
      );
      await completeAgentRun(db, runId, AgentRunStatus.Failed).catch((cause) =>
        reportError(cause, "Unbound agent run row could not be closed", {
          sessionId,
          runId,
          workflowRunId,
        })
      );
    }
    // The bind failure itself is rethrown and reported once at the procedure boundary.
    logger.warn(
      { err: cause, sessionId, runId, workflowRunId, stopped: ended },
      "Agent run could not be bound to its workflow run"
    );
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
          throw new AppError(AppErrorCode.NotFound, {
            message: `Unknown agent session: ${sessionId}`,
          });
        }

        const admitted = await admit(tx, caller, row);
        if (!admitted) return null;
        const { message } = admitted;

        // One turn at a time: quota and the running cap were checked here, and a turn run
        // behind this one would execute after its cost landed without being checked again.
        const state = await runStateOf(host.runs, row);
        if (state?.status === AgentRunState.Running) {
          throw new AppError(AppErrorCode.Conflict, {
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
      ).catch((cause) =>
        reportError(cause, "Superseded agent run could not be cancelled", {
          sessionId,
          runId: accepted.runId,
          workflowRunId: accepted.staleWorkflowRunId,
        })
      );
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
        await completeAgentRun(db, accepted.runId, AgentRunStatus.Failed);
        await signalAgentAbort(
          workflow,
          accepted.abortController.id,
          "run failed to start"
        );
      } else {
        // The workflow may have started. The lease row keeps the session blocked; the turn
        // step binds the real run id onto it, after which abort and reconcile see the run,
        // and an unbound lease is closed once its TTL passes.
        logger.warn(
          { err: error, sessionId, runId: accepted.runId, code },
          "Agent run start is unresolved; the lease is kept"
        );
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
              throw new AppError(AppErrorCode.BadRequest, {
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
            throw new AppError(AppErrorCode.Conflict, {
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
        throw new AppError(AppErrorCode.NotFound, {
          message: `Unknown agent session: ${input.sessionId}`,
        });
      }
      return { ...cursor, startedRun: true };
    },

    async attach(caller, input) {
      const row = await sessions.loadOwnedSession(caller, input.sessionId);
      if (!row?.workflowRunId || !row.turn || isRunLease(row)) return null;
      const run = await runStateOf(host.runs, row);
      return run?.status === AgentRunState.Running
        ? agentStreamCursor(row.workflowRunId, row.turn)
        : null;
    },

    async *stream(caller, input) {
      const row = await sessions.loadOwnedSession(caller, input.sessionId);
      if (!row) {
        throw new AppError(AppErrorCode.NotFound, {
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
        await completeAgentRun(
          caller.context.db,
          row.activeRunId,
          AgentRunStatus.Cancelled
        );
      }
      return true;
    },

    /**
     * Records the decision on a pending request. Once every call of its batch is decided, starts
     * the run that resumes them: the approved calls run as requested and the model reads the
     * refusals. A decision is written once. A decided batch is delivered again only when its
     * resuming run never executed; a run that ran, or whose fate is still unknown, starts nothing.
     */
    async approve(outer, input) {
      /** Set once the request exists and this call recorded or re-read its decision. */
      let recorded = false;
      const cursor = await startTurn(
        outer,
        input.sessionId,
        async (tx, caller) => {
          const existing = await getAgentApproval(
            tx,
            input.sessionId,
            input.toolCallId
          );
          // A request from before turns became resumable has no run to resume.
          if (!existing?.runId) return null;
          const interruptedRunId = existing.runId;

          if (existing.status === AgentApprovalStatus.Pending) {
            const decided = await decideAgentApproval(tx, {
              sessionId: input.sessionId,
              toolCallId: input.toolCallId,
              approved: input.approved,
              comment: input.comment,
              decidedBy: caller.userId,
            });
            if (!decided) return null;
          } else {
            const relay = existing.relayRunId
              ? await getAgentRun(tx, existing.relayRunId)
              : null;
            if (!relay || !relayNeverRan(relay)) return null;
          }
          recorded = true;

          const batch = await getAgentApprovalBatch(
            tx,
            input.sessionId,
            interruptedRunId
          );
          if (batch.some((row) => row.status === AgentApprovalStatus.Pending)) {
            return null;
          }
          // Refused here the decision rolls back with the transaction, so it can be made again.
          await assertCanStartTurn(tx, caller);

          return {
            message: {
              resume: {
                interruptedRunId,
                decisions: batch.map((row) => ({
                  toolCallId: row.toolCallId,
                  approved: row.status === AgentApprovalStatus.Approved,
                  ...(row.comment !== null && { comment: row.comment }),
                  // Refused by the turn's own checks, not by the operator.
                  ...(row.decidedBy === null &&
                    row.status === AgentApprovalStatus.Rejected && {
                      refused: true as const,
                    }),
                })),
              },
              credentials: host.credentials.read(caller.context.headers),
            },
            bind: (db, runId) =>
              setAgentApprovalRelayRun(db, {
                sessionId: input.sessionId,
                runId: interruptedRunId,
                relayRunId: runId,
              }),
          };
        }
      );
      return cursor ? { cursor } : recorded ? { cursor: null } : null;
    },
  };
};
