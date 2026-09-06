import { AGENT_TURN_KEY } from "@chia/agent-host/execution";
import type {
  AgentStreamPosition,
  AgentTurnMarker,
} from "@chia/agent-host/execution";
import type { AgentKindDefinition } from "@chia/agent-host/kind";
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
  getAgentSessionLastSeq,
  releaseAgentRunTurn,
  withAgentSessionLock,
} from "@chia/db/repos/agent";
import { AppError, isAppError } from "@chia/service-kit/errors";
import type { AppErrorCode } from "@chia/service-kit/errors";
import {
  AGENT_END_SENTINEL,
  agentApprovalToken,
  agentMessageToken,
} from "@chia/workflow-control/agent-hooks";
import type {
  AgentAbortControllerRef,
  EncryptedAgentCredentials,
} from "@chia/workflow-control/agent-hooks";
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
  claimNextAgentTurn,
  isAgentHookReady,
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

/** An operator's decision as the approval row records it. */
interface RecordedDecision {
  approved: boolean;
  comment?: string;
}

/**
 * What the lock transaction decided. Delivery to the workflow happens after it commits: the
 * database is the record of what was accepted, and a workflow command cannot be rolled back.
 * A `resume` is the parked run's next turn, already claimed on its marker; a `start` is a run
 * row written as the session's lease, to be bound to the workflow run once it exists.
 */
type Admission =
  | {
      kind: "resume";
      cursor: AgentStreamCursor;
      /** The run whose marker was claimed; released if the workflow refused the delivery. */
      activeRunId: string | null;
      claimId: string | null;
    }
  | {
      kind: "start";
      runId: string;
      abortController: AgentAbortControllerRef;
      position: AgentStreamPosition;
    };

/**
 * Whether the workflow service rejected the command before executing it. Only then is it
 * known that nothing was accepted; a timeout, a dropped response or a failure inside the
 * service may have resumed the hook, and the claim must stay until the step overwrites it
 * or the operator aborts.
 */
const deliveryRefused = (code: AppErrorCode | null): boolean =>
  code === "BAD_REQUEST" ||
  code === "UNAUTHORIZED" ||
  code === "FORBIDDEN" ||
  code === "UNPROCESSABLE_CONTENT";

/** Durable turn admission, workflow hooks and live transport for one agent kind. */
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
   * Compensates a delivery that failed. A refused command never reached the hook, so the
   * claim is released, by its id so a step that has since started is left alone. Any other
   * failure is ambiguous: the claim stays, the ids are logged, and the operator's abort is
   * the way out if the step never starts.
   */
  const settleFailedDelivery = async (
    db: DB,
    sessionId: string,
    admission: { activeRunId: string | null; claimId: string | null },
    code: AppErrorCode | null
  ) => {
    if (deliveryRefused(code)) {
      if (admission.activeRunId && admission.claimId) {
        await releaseAgentRunTurn(
          db,
          admission.activeRunId,
          AGENT_TURN_KEY,
          admission.claimId
        ).catch(() => undefined);
      }
      return;
    }
    console.error("Agent turn delivery is unresolved; the claim is kept", {
      sessionId,
      runId: admission.activeRunId,
      claimId: admission.claimId,
      code,
    });
  };

  /**
   * A workflow that started while its row still carries the lease id, so `abort` could not
   * find it. Stops it on the id only this request holds, and fails the row only once the turn
   * was seen to end; otherwise the lease keeps the session blocked and the first turn step
   * binds the real id, so the operator's abort can finish the job.
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

  return {
    /** Accepts a message under the session lock, then queues or starts its durable run. */
    async prompt(outer, input) {
      const db = outer.context.db;
      const admission = await withAgentSessionLock(
        db,
        input.sessionId,
        async (tx): Promise<Admission & { message: AgentMessagePayload }> => {
          const caller = sessions.withDb(outer, tx);
          const row = await sessions.loadOwnedSession(caller, input.sessionId);
          // The guard resolved the session already; a miss under the lock means it was just deleted.
          if (!row) {
            throw new AppError("NOT_FOUND", {
              message: `Unknown agent session: ${input.sessionId}`,
            });
          }

          if (input.text === AGENT_END_SENTINEL) {
            throw new AppError("BAD_REQUEST", {
              message: `"${AGENT_END_SENTINEL}" is reserved; it ends the session's run.`,
            });
          }
          await assertCanStartTurn(tx, caller);

          // Admitted before the turn is queued, so a bad attachment fails this request rather
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

          const message: AgentMessagePayload = {
            text: input.text,
            template: input.template,
            attachments: input.attachments,
            credentials: host.credentials.read(caller.context.headers),
          };

          const outstanding = await sessions.undecidedApprovals(
            tx,
            input.sessionId
          );
          if (outstanding.length > 0) {
            throw new AppError("CONFLICT", {
              message: `Waiting on your decision for \`${outstanding.join("`, `")}\`. Approve or reject it before sending another message.`,
            });
          }

          const state = await runStateOf(host.runs, row);
          // One turn at a time: quota and the running cap are checked here, and a turn queued
          // behind a running one would run after that turn's cost landed without being checked.
          if (state?.status === "running") {
            throw new AppError("CONFLICT", {
              message:
                "A turn is still running. Wait for it to finish or stop it before sending another message.",
            });
          }

          if (state && row.workflowRunId) {
            if (
              !(await isAgentHookReady(
                host.runs,
                agentMessageToken(input.sessionId)
              ))
            ) {
              throw new AppError("CONFLICT", {
                message:
                  "The session's run is still starting up. Retry in a moment.",
              });
            }

            const claim = await claimNextAgentTurn(
              host.runs,
              tx,
              row,
              row.workflowRunId
            );
            return {
              kind: "resume",
              cursor: claim.cursor,
              activeRunId: row.activeRunId,
              claimId: claim.claimId,
              message,
            };
          }

          // A parked controller that outlives a refused admission expires on its TTL, so
          // starting it before the commit costs nothing that the database has to know about.
          const abortController = await startAgentAbortController(
            caller.context.workflow
          );
          const runId = crypto.randomUUID();
          const position: AgentStreamPosition = {
            streamIndex: 0,
            deltaStreamIndex: 0,
          };
          const turn: AgentTurnMarker = {
            seqBefore: await getAgentSessionLastSeq(tx, row.id),
            ...position,
            running: true,
            claimId: null,
          };
          await createAgentRun(tx, {
            id: runId,
            sessionId: input.sessionId,
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
          return { kind: "start", runId, abortController, position, message };
        }
      );

      const workflow = outer.context.workflow;
      if (admission.kind === "resume") {
        try {
          await workflow.resumeAgentMessage(input.sessionId, admission.message);
        } catch (error) {
          await settleFailedDelivery(
            db,
            input.sessionId,
            admission,
            isAppError(error) ? error.code : null
          );
          throw error;
        }
        return { ...admission.cursor, startedRun: false };
      }

      let workflowRunId;
      try {
        workflowRunId = await workflow.startAgentSession({
          sessionId: input.sessionId,
          runId: admission.runId,
          userId: outer.userId,
          abortController: admission.abortController,
          firstMessage: admission.message,
        });
      } catch (error) {
        const code = isAppError(error) ? error.code : null;
        if (deliveryRefused(code)) {
          await completeAgentRun(db, admission.runId, "failed");
          await signalAgentAbort(
            workflow,
            admission.abortController.id,
            "run failed to start"
          );
        } else {
          // The workflow may have started. The lease row keeps the session blocked; the first
          // turn step binds the real run id onto it, after which abort and reconcile see the
          // run, and an unbound lease is closed once its TTL passes.
          console.error("Agent run start is unresolved; the lease is kept", {
            sessionId: input.sessionId,
            runId: admission.runId,
            code,
          });
        }
        throw error;
      }
      try {
        await bindAgentRunExternalId(db, admission.runId, workflowRunId);
      } catch (error) {
        await settleUnboundRun(
          db,
          workflow,
          input.sessionId,
          admission.runId,
          workflowRunId,
          admission.abortController,
          error
        );
        throw error;
      }
      return {
        ...agentStreamCursor(workflowRunId, admission.position),
        startedRun: true,
      };
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
     * Records the decision under the session lock, then resumes the parked run. The row is the
     * record: a decision whose delivery failed is redelivered as recorded, whatever this call
     * says, for as long as the run still waits on it.
     */
    async approve(outer, input) {
      const db = outer.context.db;
      const token = agentApprovalToken(input.sessionId, input.toolCallId);
      const admission = await withAgentSessionLock(
        db,
        input.sessionId,
        async (
          tx
        ): Promise<{
          cursor: AgentStreamCursor;
          activeRunId: string | null;
          claimId: string | null;
          decision: RecordedDecision & {
            credentials?: EncryptedAgentCredentials;
          };
        } | null> => {
          const caller = sessions.withDb(outer, tx);
          const row = await sessions.loadOwnedSession(caller, input.sessionId);
          if (!row?.workflowRunId) return null;

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
            if (!(await isAgentHookReady(host.runs, token))) return null;
            decision = {
              approved: existing.status === "approved",
              comment: existing.comment ?? undefined,
            };
          }

          const claim = await claimNextAgentTurn(
            host.runs,
            tx,
            row,
            row.workflowRunId
          );
          return {
            cursor: claim.cursor,
            activeRunId: row.activeRunId,
            claimId: claim.claimId,
            decision: {
              ...decision,
              credentials: host.credentials.read(caller.context.headers),
            },
          };
        }
      );
      if (!admission) return null;

      try {
        await outer.context.workflow.resumeAgentApproval(
          input.sessionId,
          input.toolCallId,
          admission.decision
        );
      } catch (error) {
        await settleFailedDelivery(
          db,
          input.sessionId,
          admission,
          isAppError(error) ? error.code : null
        );
        throw error;
      }
      return admission.cursor;
    },
  };
};
