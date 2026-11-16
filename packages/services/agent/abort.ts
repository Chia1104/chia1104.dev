import { reportError } from "@chia/observability/report";
import type { WorkflowControlClient } from "@chia/workflow-control/client";

/** Asks the run executing `runId`'s turn to stop it; `false` when the run could not be reached. */
export const signalAgentAbort = async (
  workflow: Pick<WorkflowControlClient, "resumeAgentAbort">,
  runId: string,
  reason: string
): Promise<boolean> => {
  try {
    await workflow.resumeAgentAbort(runId, reason);
    return true;
  } catch (error) {
    reportError(error, "Agent abort could not be signalled", {
      runId,
      reason,
    });
    return false;
  }
};
