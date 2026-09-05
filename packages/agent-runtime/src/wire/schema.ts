/**
 * The wire contract and its client-side view model (`./fold.ts`), with no runtime dependency on
 * Pi or any provider SDK. These are the modules browsers and SSR bundles import. `./replay.ts`
 * is not among them: rebuilding events from persisted Pi entries classifies provider errors and
 * so needs pi-ai.
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

/** Bounds a selection so a guest cannot ship a whole post as one prompt. */
export const SELECTION_TEXT_MAX_CHARS = 4000;

/**
 * Where selected text came from, precise enough for the kind to find it again: a draft by
 * line range for the editor, a published post by heading trail for the reader.
 */
export const agentSelectionSourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("draft"),
    id: z.number().int(),
    locale: z.string().min(1),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("feed"),
    id: z.number().int(),
    locale: z.string().min(1),
    /** Heading trail as `search_posts` reports it, e.g. `"Setup > Install"`. */
    headingPath: z.string().max(400).optional(),
  }),
]);

/**
 * What a prompt hands the agent beside the text: a record by reference, or text the operator
 * selected on screen with its source. Which of these a kind admits is that kind's policy.
 */
export const agentAttachmentInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("draft"), id: z.number().int() }),
  z.object({
    type: z.literal("selection"),
    text: z.string().min(1).max(SELECTION_TEXT_MAX_CHARS),
    source: agentSelectionSourceSchema,
  }),
]);

/** The input as persisted and replayed, with the label the kind filled for clients. */
export const agentAttachmentSchema = z.discriminatedUnion("type", [
  agentAttachmentInputSchema.options[0].extend({
    label: z.string().optional(),
  }),
  agentAttachmentInputSchema.options[1].extend({
    label: z.string().optional(),
  }),
]);

export type AgentSelectionSource = z.infer<typeof agentSelectionSourceSchema>;
export type AgentAttachmentInput = z.infer<typeof agentAttachmentInputSchema>;
export type AgentAttachment = z.infer<typeof agentAttachmentSchema>;

export const agentWireEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("run:start"), sessionId: z.string() }),
  z.object({
    type: z.literal("user"),
    messageId: z.string(),
    /** What the operator typed; what they attached is `attachments`, rendered for the model separately. */
    text: z.string(),
    attachments: z.array(agentAttachmentSchema).optional(),
    /** Epoch ms. Optional only so streams written before it existed still parse. */
    at: z.number().optional(),
    /**
     * Set when the turn was synthesised by the session's workflow rather than typed by the
     * operator. Today only the relayed approval decision. Clients render these as notices.
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
    /**
     * The call never produced a result: the turn was stopped, the process died, or a fork cut
     * the branch between the call and its result.
     * Distinct from `isError`, which is the tool itself failing. The model sees an empty result
     * for these, so the client says "stopped".
     */
    aborted: z.literal(true).optional(),
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
   * entry, so a rewind without a summary leaves no notice: there is nothing durable to show.
   */
  z.object({
    type: z.literal("session:rewound"),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("state:changed"),
    /**
     * What changed, as named by the agent kind's policy (`"draft"` for the writing agent).
     * Bump-only: the client refetches rather than diffing over the wire.
     */
    scope: z.string().optional(),
    revision: z.number(),
  }),
  z.object({
    type: z.literal("error"),
    /**
     * See `AgentErrorKind`. The kind is all a client gets; it picks a headline from it. The
     * provider's or the host's own text stays in the server log.
     */
    kind: agentErrorKindSchema,
  }),
  z.object({
    type: z.literal("run:end"),
    reason: z.enum(["done", "aborted", "error", "awaiting_approval"]),
  }),
]);

export type AgentWireEvent = z.infer<typeof agentWireEventSchema>;
