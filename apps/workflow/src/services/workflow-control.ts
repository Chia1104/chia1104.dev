import { getRun, start } from "workflow/api";

import {
  agentAbortHook,
  agentAbortToken,
  agentApprovalHook,
  agentApprovalToken,
  agentMessageHook,
  agentMessageToken,
} from "@chia/workflow-control/agent-hooks";
import type { WorkflowControlCommand } from "@chia/workflow-control/contract";
import type { WorkflowControlResult } from "@chia/workflow-control/contract";

export const executeLocalWorkflowCommand = async (
  command: WorkflowControlCommand
): Promise<WorkflowControlResult> => {
  switch (command.type) {
    case "agent-abort:start": {
      const { agentAbortWorkflow } =
        await import("../workflows/agent-abort.workflow");
      const run = await start(agentAbortWorkflow, [command.request]);
      return { type: "started", runId: run.runId };
    }
    case "agent-session:start": {
      const { agentSessionWorkflow } =
        await import("../workflows/agent-session.workflow");
      const run = await start(agentSessionWorkflow, [command.request]);
      return { type: "started", runId: run.runId };
    }
    case "agent-message:resume": {
      await agentMessageHook.resume(
        agentMessageToken(command.sessionId),
        command.payload
      );
      return { type: "completed" };
    }
    case "agent-approval:resume": {
      await agentApprovalHook.resume(
        agentApprovalToken(command.sessionId, command.toolCallId),
        command.payload
      );
      return { type: "completed" };
    }
    case "agent-abort:resume": {
      await agentAbortHook.resume(
        agentAbortToken(command.controllerId),
        command.payload
      );
      return { type: "completed" };
    }
    case "feed-index:start": {
      const { feedIndexingWorkflow } =
        await import("../workflows/feed-indexing.workflow");
      const run = await start(feedIndexingWorkflow, [command.request]);
      return { type: "started", runId: run.runId };
    }
    case "feed-remove:start": {
      const { removeFeedFromSearchIndexWorkflow } =
        await import("../workflows/feed-removal.workflow");
      const run = await start(removeFeedFromSearchIndexWorkflow, [
        command.request,
      ]);
      return { type: "started", runId: run.runId };
    }
    case "resource-index:start": {
      const { indexResourceWorkflow } =
        await import("../workflows/resource-index.workflow");
      const run = await start(indexResourceWorkflow, [command.request]);
      return { type: "started", runId: run.runId };
    }
    case "resource-reindex:start": {
      const { resourceReindexWorkflow } =
        await import("../workflows/resource-reindex.workflow");
      const run = await start(resourceReindexWorkflow, [command.request]);
      return { type: "started", runId: run.runId };
    }
    case "memory-consolidation:start": {
      const { memoryConsolidationWorkflow } =
        await import("../workflows/memory-consolidation.workflow");
      const run = await start(memoryConsolidationWorkflow, [command.request]);
      return { type: "started", runId: run.runId };
    }
    case "run:cancel": {
      await getRun(command.runId).cancel();
      return { type: "completed" };
    }
  }
};

const startedRunId = async (command: WorkflowControlCommand) => {
  const result = await executeLocalWorkflowCommand(command);
  if (result.type !== "started") throw new Error("Workflow did not start.");
  return result.runId;
};

export const workflowControl = {
  startFeedIndex: (feedID: number) =>
    startedRunId({ type: "feed-index:start", request: { feedID } }),
  startResourceIndex: (request: { sourceType: string; sourceId: number }) =>
    startedRunId({ type: "resource-index:start", request }),
  startMemoryConsolidation: (sessionId: string) =>
    startedRunId({
      type: "memory-consolidation:start",
      request: { sessionId },
    }),
  async resumeAgentAbort(controllerId: string, reason: string) {
    await executeLocalWorkflowCommand({
      type: "agent-abort:resume",
      controllerId,
      payload: { reason },
    });
  },
};
