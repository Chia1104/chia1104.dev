import * as z from "zod";

import {
  agentAbortControllerRefSchema,
  agentApprovalPayloadSchema,
  agentMessagePayloadSchema,
} from "./agent.hooks";

const agentSessionRequestSchema = z.object({
  sessionId: z.string(),
  runId: z.string(),
  userId: z.string(),
  abortController: agentAbortControllerRefSchema,
  firstMessage: agentMessagePayloadSchema,
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
    type: z.literal("agent-message:resume"),
    sessionId: z.string(),
    payload: agentMessagePayloadSchema,
  }),
  z.object({
    type: z.literal("agent-approval:resume"),
    sessionId: z.string(),
    toolCallId: z.string(),
    payload: agentApprovalPayloadSchema,
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
    request: z.object({ sessionId: z.string().min(1) }),
  }),
  z.object({ type: z.literal("run:cancel"), runId: z.string() }),
]);

export type WorkflowControlCommand = z.infer<
  typeof workflowControlCommandSchema
>;

export const workflowControlResultSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("started"), runId: z.string() }),
  z.object({ type: z.literal("completed") }),
]);

export type WorkflowControlResult = z.infer<typeof workflowControlResultSchema>;

export const workflowControlErrorSchema = z.object({ error: z.string() });
