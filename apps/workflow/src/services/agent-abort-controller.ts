import { getRun } from "workflow/api";

import type { AgentAbortMessage } from "@chia/agent-host/execution";

import { workflowControl } from "./workflow-control";

export const subscribeAgentAbort = (controllerRunId: string) => {
  const controller = new AbortController();
  const reader = getRun(controllerRunId)
    .getReadable<AgentAbortMessage>()
    .getReader();

  void (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.type === "abort" && !value.expired) {
          controller.abort(new DOMException(value.reason, "AbortError"));
          break;
        }
      }
    } catch {
      // A dropped subscription must not stop the turn; the abort simply cannot reach it.
    } finally {
      reader.releaseLock();
    }
  })();

  return {
    signal: controller.signal,
    dispose: () => void reader.cancel().catch(() => undefined),
  };
};

export const signalAgentAbort = async (
  controllerId: string,
  reason: string
): Promise<boolean> => {
  try {
    await workflowControl.resumeAgentAbort(controllerId, reason);
    return true;
  } catch {
    return false;
  }
};
