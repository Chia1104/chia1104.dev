import { AppError, appErrorCodeFromStatus } from "@chia/service-kit/errors";
import { withServiceEndpoint } from "@chia/utils/config";
import { Service } from "@chia/utils/schema";
import type {
  AgentAbortControllerRef,
  EncryptedAgentCredentials,
} from "@chia/workflow-control/agent-hooks";
import {
  workflowControlErrorSchema,
  workflowControlResultSchema,
} from "@chia/workflow-control/contract";
import type {
  WorkflowControlCommand,
  WorkflowControlResult,
} from "@chia/workflow-control/contract";

import { env } from "../env";

type WorkflowControlFetch = (
  input: string,
  init: RequestInit
) => Promise<Response>;

interface CreateWorkflowControlOptions {
  /** Absolute URL of the control route; resolved from `INTERNAL_WORKFLOW_SERVICE_ENDPOINT` by default. */
  url?: string;
  token: string;
  fetch?: WorkflowControlFetch;
}

interface AgentSessionStartRequest {
  sessionId: string;
  runId: string;
  userId: string;
  abortController: AgentAbortControllerRef;
  firstMessage: {
    text: string;
    template?: { name: string; args?: string[] };
    preAuthorizeToolNames?: string[];
    credentials?: EncryptedAgentCredentials;
  };
}

interface AgentApprovalPayload {
  approved: boolean;
  comment?: string;
  credentials?: EncryptedAgentCredentials;
}

const CONTROL_TIMEOUT_MS = 30_000;

/**
 * `apps/workflow` has one control route at its root and is only reachable over the private
 * network, so there is a single internal endpoint and no version prefix.
 */
const resolveControlUrl = (): string => {
  const url = withServiceEndpoint("/", Service.Workflow, {
    isInternal: true,
    version: "NO_PREFIX",
  });
  if (!/^https?:\/\//.test(url)) {
    throw new Error(
      "INTERNAL_WORKFLOW_SERVICE_ENDPOINT is required to reach apps/workflow."
    );
  }
  return url;
};

const startedRunId = (result: WorkflowControlResult): string => {
  if (result.type !== "started") {
    throw new Error("Workflow control returned no run id.");
  }
  return result.runId;
};

export const createWorkflowControl = ({
  url = resolveControlUrl(),
  token,
  fetch: fetcher = globalThis.fetch,
}: CreateWorkflowControlOptions) => {
  const execute = async (
    command: WorkflowControlCommand
  ): Promise<WorkflowControlResult> => {
    const response = await fetcher(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(CONTROL_TIMEOUT_MS),
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      // The workflow service answers with the `AppError` status it hit, so the code round-trips.
      const parsed = workflowControlErrorSchema.safeParse(payload);
      throw new AppError(appErrorCodeFromStatus(response.status), {
        message: parsed.success
          ? parsed.data.error
          : `Workflow control failed with HTTP ${response.status}.`,
      });
    }
    return workflowControlResultSchema.parse(payload);
  };

  return {
    async startAgentAbort(request: { id: string; ttlMs: number }) {
      return startedRunId(
        await execute({ type: "agent-abort:start", request })
      );
    },
    async startAgentSession(request: AgentSessionStartRequest) {
      return startedRunId(
        await execute({ type: "agent-session:start", request })
      );
    },
    async resumeAgentMessage(
      sessionId: string,
      payload: AgentSessionStartRequest["firstMessage"]
    ) {
      await execute({ type: "agent-message:resume", sessionId, payload });
    },
    async resumeAgentApproval(
      sessionId: string,
      toolCallId: string,
      payload: AgentApprovalPayload
    ) {
      await execute({
        type: "agent-approval:resume",
        sessionId,
        toolCallId,
        payload,
      });
    },
    async resumeAgentAbort(controllerId: string, reason: string) {
      await execute({
        type: "agent-abort:resume",
        controllerId,
        payload: { reason },
      });
    },
    async startFeedIndex(feedID: number) {
      return startedRunId(
        await execute({ type: "feed-index:start", request: { feedID } })
      );
    },
    async startFeedRemoval(translationIDs: number[]) {
      return startedRunId(
        await execute({
          type: "feed-remove:start",
          request: { translationIDs },
        })
      );
    },
    async startResourceIndex(request: {
      sourceType: string;
      sourceId: number;
    }) {
      return startedRunId(
        await execute({ type: "resource-index:start", request })
      );
    },
    async startResourceReindex(request: { onlyMissing?: boolean }) {
      return startedRunId(
        await execute({ type: "resource-reindex:start", request })
      );
    },
    async startMemoryConsolidation(sessionId: string) {
      return startedRunId(
        await execute({
          type: "memory-consolidation:start",
          request: { sessionId },
        })
      );
    },
    async cancelRun(runId: string) {
      await execute({ type: "run:cancel", runId });
    },
  };
};

export const workflowControl = createWorkflowControl({
  token: env.INTERNAL_WORKFLOW_SERVICE_TOKEN,
});
