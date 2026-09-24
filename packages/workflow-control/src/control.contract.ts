import * as z from "zod";

import {
  agentAbortControllerRefSchema,
  agentMessagePayloadSchema,
} from "./agent.schema";

const agentSessionRequestSchema = z.object({
  sessionId: z.string(),
  runId: z.string(),
  userId: z.string(),
  abortController: agentAbortControllerRefSchema,
  message: agentMessagePayloadSchema,
});

export const workflowControlCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("agent-abort:start"),
    request: z.object({ id: z.string(), ttlMs: z.number().int().positive() }),
  }),
  z.object({
    type: z.literal("agent-session:start"),
    request: agentSessionRequestSchema,
  }),
  z.object({
    type: z.literal("agent-abort:resume"),
    controllerId: z.string(),
    payload: z.object({ reason: z.string() }),
  }),
  z.object({
    type: z.literal("feed-index:start"),
    request: z.object({ feedID: z.number() }),
  }),
  z.object({
    type: z.literal("feed-summary:start"),
    request: z.object({ feedID: z.number() }),
  }),
  z.object({
    type: z.literal("report-triage:start"),
    request: z.object({
      reportId: z.number().int().positive(),
      /** `false` skips the operator email: a triage the operator started by hand. */
      notify: z.boolean().optional(),
    }),
  }),
  z.object({
    type: z.literal("feed-remove:start"),
    request: z.object({ translationIDs: z.array(z.number()) }),
  }),
  z.object({
    type: z.literal("resource-index:start"),
    request: z.object({
      sourceType: z.string().min(1),
      sourceId: z.number().int().positive(),
    }),
  }),
  z.object({
    type: z.literal("resource-reindex:start"),
    request: z.object({ onlyMissing: z.boolean().optional() }),
  }),
  z.object({
    type: z.literal("memory-consolidation:start"),
    request: z.object({
      sessionId: z.string().min(1),
      /** Sleep before extracting, so a session is read once it has gone quiet. */
      delayMs: z.number().int().nonnegative().optional(),
    }),
  }),
  z.object({ type: z.literal("run:cancel"), runId: z.string() }),
  z.object({ type: z.literal("run:status"), runId: z.string() }),
]);

export type WorkflowControlCommand = z.infer<
  typeof workflowControlCommandSchema
>;

export const WorkflowRunStatus = {
  Pending: "pending",
  Running: "running",
  Completed: "completed",
  Failed: "failed",
  Cancelled: "cancelled",
} as const;

export type WorkflowRunStatus =
  (typeof WorkflowRunStatus)[keyof typeof WorkflowRunStatus];

export const workflowRunStatusSchema = z.enum(WorkflowRunStatus);

/**
 * A run as the API process needs it to reconcile records: whether the World
 * still has it, its status, and (only once completed) its output.
 */
export const workflowRunStateSchema = z.object({
  type: z.literal("run"),
  exists: z.boolean(),
  status: workflowRunStatusSchema.optional(),
  output: z.unknown().optional(),
});

export type WorkflowRunState = z.infer<typeof workflowRunStateSchema>;

export const workflowControlResultSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("started"), runId: z.string() }),
  z.object({ type: z.literal("completed") }),
  workflowRunStateSchema,
]);

export type WorkflowControlResult = z.infer<typeof workflowControlResultSchema>;

export const workflowControlErrorSchema = z.object({ error: z.string() });

/** What `report-triage:start` leaves as its run output; the statuses are the step's names. */
export const reportTriageOutputSchema = z.object({
  reportId: z.number().int(),
  triage: z.string(),
  /** Absent when the run stopped before the email step. */
  notified: z.string().optional(),
});

export type ReportTriageOutput = z.infer<typeof reportTriageOutputSchema>;

/** What `feed-summary:start` leaves as its run output, per translation. */
export const feedSummaryOutputSchema = z.object({
  success: z.boolean(),
  /** Absent when the feed was gone by the time the run read it. */
  error: z.string().optional(),
  translations: z
    .array(
      z.object({
        locale: z.string(),
        /** `ok`, `skipped: …` or `failed: …`. */
        status: z.string(),
      })
    )
    .optional(),
});

export type FeedSummaryOutput = z.infer<typeof feedSummaryOutputSchema>;

/** The run id a start command answered with. */
export const startedRunId = (result: WorkflowControlResult): string => {
  if (result.type !== "started") {
    throw new Error("Workflow control returned no run id.");
  }
  return result.runId;
};
