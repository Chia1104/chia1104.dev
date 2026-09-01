import { AppError, appErrorCodeFromStatus } from "@chia/service-kit/errors";

import type {
  AgentAbortControllerRef,
  EncryptedAgentCredentials,
} from "./agent.hooks";
import {
  workflowControlErrorSchema,
  workflowControlResultSchema,
} from "./control.contract";
import type {
  WorkflowControlCommand,
  WorkflowControlResult,
  WorkflowRunState,
} from "./control.contract";

/**
 * The API process's view of `apps/workflow`: one authenticated POST per
 * command. The host resolves the URL and holds the token; this module knows
 * nothing about env.
 */

type WorkflowControlFetch = (
  input: string,
  init: RequestInit
) => Promise<Response>;

export interface CreateWorkflowControlClientOptions {
  /** Absolute URL of the control route (`/` on the workflow service). */
  url: string;
  token: string;
  fetch?: WorkflowControlFetch;
}

export interface AgentSessionStartRequest {
  sessionId: string;
  runId: string;
  userId: string;
  abortController: AgentAbortControllerRef;
  firstMessage: AgentMessagePayload;
}

export interface AgentMessagePayload {
  text: string;
  template?: { name: string; args?: string[] };
  preAuthorizeToolNames?: string[];
  credentials?: EncryptedAgentCredentials;
}

export interface AgentApprovalPayload {
  approved: boolean;
  comment?: string;
  credentials?: EncryptedAgentCredentials;
}

const CONTROL_TIMEOUT_MS = 30_000;

const startedRunId = (result: WorkflowControlResult): string => {
  if (result.type !== "started") {
    throw new Error("Workflow control returned no run id.");
  }
  return result.runId;
};

export const createWorkflowControlClient = ({
  url,
  token,
  fetch: fetcher = globalThis.fetch,
}: CreateWorkflowControlClientOptions) => {
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
      // The workflow service returns the `AppError` status it hit, so the code round-trips.
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
    async resumeAgentMessage(sessionId: string, payload: AgentMessagePayload) {
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
    /** `exists: false` when the World has no such run. */
    async getRun(runId: string): Promise<WorkflowRunState> {
      const result = await execute({ type: "run:status", runId });
      if (result.type !== "run") {
        throw new Error("Workflow control returned no run state.");
      }
      return result;
    },
  };
};

export type WorkflowControlClient = ReturnType<
  typeof createWorkflowControlClient
>;
