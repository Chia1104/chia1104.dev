import type { JsonObject } from "@chia/utils/json";
import { agentAbortControllerRefSchema } from "@chia/workflow-control/agent-hooks";
import type { AgentAbortControllerRef } from "@chia/workflow-control/agent-hooks";
import type { WorkflowControlClient } from "@chia/workflow-control/client";

const AGENT_ABORT_TTL_MS = 24 * 60 * 60 * 1000;

export const AGENT_ABORT_CONTROLLER_KEY = "abortController";

export const readAgentAbortControllerRef = (
  metadata: JsonObject
): AgentAbortControllerRef | undefined => {
  const parsed = agentAbortControllerRefSchema.safeParse(
    metadata[AGENT_ABORT_CONTROLLER_KEY]
  );
  return parsed.success ? parsed.data : undefined;
};

export const startAgentAbortController = async (
  workflow: WorkflowControlClient
): Promise<AgentAbortControllerRef> => {
  const id = crypto.randomUUID();
  const runId = await workflow.startAgentAbort({
    id,
    ttlMs: AGENT_ABORT_TTL_MS,
  });
  return { id, runId };
};

export const signalAgentAbort = async (
  workflow: WorkflowControlClient,
  controllerId: string,
  reason: string
): Promise<boolean> => {
  try {
    await workflow.resumeAgentAbort(controllerId, reason);
    return true;
  } catch {
    return false;
  }
};
