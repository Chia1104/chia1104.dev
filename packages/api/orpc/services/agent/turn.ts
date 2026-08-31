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
  getAgentSessionLastSeq,
  withAgentSessionLock,
} from "@chia/db/repos/agent";
import { AppError } from "@chia/service-kit/errors";
import {
  AGENT_END_SENTINEL,
  agentMessageToken,
} from "@chia/workflow-control/agent-hooks";

import type { AgentServiceHost } from "../agent.factory";
import type { AgentKindService, AgentServiceCaller } from "../agent.service";

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

  return {
    /** Accepts a message under the session lock and queues or starts its durable run. */
    prompt: (outer, input) =>
      withAgentSessionLock(outer.context.db, input.sessionId, async (tx) => {
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

        const message = {
          text: input.text,
          template: input.template,
          preAuthorizeToolNames: input.preAuthorizeToolNames,
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

        if (
          row.workflowRunId &&
          (await isRunLive(host.runs, row.workflowRunId))
        ) {
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

          const cursor = await claimNextAgentTurn(
            host.runs,
            tx,
            row,
            row.workflowRunId
          );
          await caller.context.workflow.resumeAgentMessage(
            input.sessionId,
            message
          );
          return { ...cursor, startedRun: false };
        }

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

        let workflowRunId;
        try {
          workflowRunId = await caller.context.workflow.startAgentSession({
            sessionId: input.sessionId,
            runId,
            userId: caller.userId,
            abortController,
            firstMessage: message,
          });
        } catch (error) {
          await completeAgentRun(tx, runId, "failed");
          throw error;
        }
        await bindAgentRunExternalId(tx, runId, workflowRunId);
        return {
          ...agentStreamCursor(workflowRunId, position),
          startedRun: true,
        };
      }),

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

    approve: (outer, input) =>
      withAgentSessionLock(outer.context.db, input.sessionId, async (tx) => {
        const caller = sessions.withDb(outer, tx);
        const row = await sessions.loadOwnedSession(caller, input.sessionId);
        if (!row?.workflowRunId) return null;

        await assertCanStartTurn(tx, caller);
        const decided = await decideAgentApproval(tx, {
          sessionId: input.sessionId,
          toolCallId: input.toolCallId,
          approved: input.approved,
          comment: input.comment,
          decidedBy: caller.userId,
        });
        if (!decided) return null;

        const cursor = await claimNextAgentTurn(
          host.runs,
          tx,
          row,
          row.workflowRunId
        );
        await caller.context.workflow.resumeAgentApproval(
          input.sessionId,
          input.toolCallId,
          {
            approved: input.approved,
            comment: input.comment,
            credentials: host.credentials.read(caller.context.headers),
          }
        );
        return cursor;
      }),
  };
};
