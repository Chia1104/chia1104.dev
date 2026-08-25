/**
 * The wire contract and its client-side view model (`./fold.ts`), with no runtime dependency on
 * Pi or any provider SDK — these are the modules browsers and SSR bundles import. `./replay.ts`
 * is deliberately not among them: rebuilding events from persisted Pi entries classifies
 * provider errors and so needs pi-ai.
 */

import * as z from "zod";

export const agentErrorKindSchema = z.enum([
  "auth",
  "quota",
  "rate_limited",
  "context_overflow",
  "budget_exhausted",
  "provider",
  "internal",
]);

const usageSchema = z.object({
  input: z.number(),
  output: z.number(),
  cacheRead: z.number().optional(),
  cacheWrite: z.number().optional(),
  costTotal: z.number().optional(),
});

export const agentWireEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("run:start"), sessionId: z.string() }),
  z.object({
    type: z.literal("user"),
    messageId: z.string(),
    text: z.string(),
    /** Epoch ms. Optional only so streams written before it existed still parse. */
    at: z.number().optional(),
    /**
     * Set when the turn was synthesised by the session's workflow rather than typed by the
     * operator — today only the relayed approval decision. Clients render these as notices.
     */
    origin: z.enum(["operator-decision"]).optional(),
  }),
  z.object({ type: z.literal("assistant:start"), messageId: z.string() }),
  z.object({
    type: z.literal("assistant:delta"),
    messageId: z.string(),
    channel: z.enum(["text", "thinking"]),
    delta: z.string(),
  }),
  z.object({
    type: z.literal("assistant:end"),
    messageId: z.string(),
    text: z.string(),
    thinking: z.string().optional(),
    usage: usageSchema.optional(),
    stopReason: z.string().optional(),
    /** Epoch ms of the completed message. */
    at: z.number().optional(),
  }),
  z.object({
    type: z.literal("tool:start"),
    toolCallId: z.string(),
    toolName: z.string(),
    label: z.string(),
    tier: z.string(),
    args: z.unknown(),
  }),
  z.object({
    type: z.literal("tool:update"),
    toolCallId: z.string(),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("tool:end"),
    toolCallId: z.string(),
    toolName: z.string(),
    isError: z.boolean(),
    summary: z.string(),
    /** Per-tool view model. Shape is the tool's `details`, narrowed by the tool itself. */
    details: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("approval:request"),
    toolCallId: z.string(),
    toolName: z.string(),
    tier: z.string(),
    args: z.unknown(),
  }),
  z.object({
    type: z.literal("approval:resolved"),
    toolCallId: z.string(),
    approved: z.boolean(),
    comment: z.string().optional(),
  }),
  z.object({
    type: z.literal("session:compacted"),
    summary: z.string(),
    tokensBefore: z.number(),
  }),
  /**
   * A rewind that summarised the branch it left behind. Replayed from the `branch_summary`
   * entry, so a rewind without a summary leaves no notice — there is nothing durable to show.
   */
  z.object({
    type: z.literal("session:rewound"),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("state:changed"),
    /**
     * What changed, as named by the agent kind's policy (`"draft"` for the writing agent).
     * Bump-only — the client refetches rather than diffing over the wire.
     */
    scope: z.string().optional(),
    revision: z.number(),
  }),
  z.object({
    type: z.literal("error"),
    /** See `AgentErrorKind`; lets a client suggest the next step instead of echoing the provider. */
    kind: agentErrorKindSchema,
    message: z.string(),
  }),
  z.object({
    type: z.literal("run:end"),
    reason: z.enum(["done", "aborted", "error", "awaiting_approval"]),
  }),
]);

export type AgentWireEvent = z.infer<typeof agentWireEventSchema>;
