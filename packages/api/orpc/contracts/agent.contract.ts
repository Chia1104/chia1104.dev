import { eventIterator, oc } from "@orpc/contract";
import * as z from "zod";

import { agentWireEventSchema } from "@chia/agent-core/events";
import { locale } from "@chia/db";

import { agentUiEventSchema } from "../agent-ai-transport";

import { withMetaSchema } from "./shared";

/**
 * Shared agent transport contract.
 *
 * RPC-only — no `.route({ method, path })` annotations. The REST surface is a catch-all over the
 * same router, and an event-iterator procedure is not meaningfully addressable as REST, so these
 * are deliberately kept off it. Kind-specific fields stay optional; the runtime selected by
 * `agent_session.kind` owns their validation.
 */

// ============================================
// Shared shapes
// ============================================

const thinkingLevelSchema = z.enum([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

/**
 * Tiers are per-kind policy, so the contract carries the string rather than a union. `@chia/agent-core`
 * deliberately keeps `ToolTier` open for the same reason — narrowing lives in each kind's package.
 */
const toolTierSchema = z.string();

export const agentSessionSummarySchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  kind: z.string(),
  modelId: z.string().nullable().optional(),
  thinkingLevel: thinkingLevelSchema.nullable().optional(),
  /** Writing-agent extension retained for the current dashboard. Other kinds omit it. */
  targetFeedId: z.number().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const draftTranslationSchema = z.object({
  title: z.string().optional(),
  excerpt: z.string().nullish(),
  description: z.string().nullish(),
  summary: z.string().nullish(),
  content: z.string().optional(),
});

export const agentDraftSchema = z.object({
  feedMeta: z.object({
    slug: z.string().optional(),
    type: z.string().optional(),
    contentType: z.string().optional(),
    defaultLocale: z.enum(locale.enumValues).optional(),
    mainImage: z.string().nullish(),
    tagSlugs: z.array(z.string()).optional(),
  }),
  translations: z.partialRecord(
    z.enum(locale.enumValues),
    draftTranslationSchema
  ),
  committedFeedId: z.number().optional(),
});

export const agentSessionDetailSchema = z.object({
  session: agentSessionSummarySchema,
  /** Common LLM settings. A non-LLM harness can omit this block. */
  settings: z
    .object({
      providerId: z.string(),
      modelId: z.string(),
      thinkingLevel: thinkingLevelSchema,
      activeToolNames: z.array(z.string()).nullable(),
      autoApprove: z.array(toolTierSchema),
    })
    .optional(),
  /** Versioned kind-owned configuration persisted on the shared session record. */
  runtimeConfig: z.record(z.string(), z.unknown()).optional(),
  configVersion: z.number().int().positive().optional(),
  /** Optional runtime-owned state for kinds that do not have a dedicated public contract yet. */
  state: z.unknown().optional(),
  /** Writing-agent state. Other kinds expose their own state contract. */
  draft: agentDraftSchema.optional(),
  /**
   * The transcript replayed as wire events, so the client folds it with the exact same reducer it
   * uses for the live stream.
   */
  events: z.array(agentWireEventSchema),
  pendingApprovals: z.array(
    z.object({
      toolCallId: z.string(),
      toolName: z.string(),
      args: z.unknown().optional(),
    })
  ),
  stats: z.object({
    messageCount: z.number(),
    totalTokens: z.number(),
    costTotal: z.number(),
  }),
});

// ============================================
// Sessions
// ============================================

export const listAgentSessionsContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {} })
  .input(
    z
      .object({
        kind: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        includeDeleted: z.boolean().optional(),
      })
      .optional()
  )
  .output(withMetaSchema(agentSessionSummarySchema));

export const createAgentSessionContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, BAD_REQUEST: {} })
  .input(
    z.object({
      /** Agent kind is required because creation has no stored session to dispatch from. */
      kind: z.string().min(1),
      title: z.string().max(200).optional(),
      /** Seeds the draft buffer from this post so the agent edits rather than starts fresh. */
      targetFeedId: z.number().int().optional(),
      modelId: z.string().optional(),
      thinkingLevel: thinkingLevelSchema.optional(),
      autoApprove: z.array(toolTierSchema).optional(),
      runtimeConfig: z.record(z.string(), z.unknown()).optional(),
    })
  )
  .output(agentSessionDetailSchema);

export const getAgentSessionContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, NOT_FOUND: {} })
  .input(
    z.object({
      /** Agent kind. Optional while only one is registered. */
      kind: z.string().optional(),
      sessionId: z.string(),
    })
  )
  .output(agentSessionDetailSchema);

export const deleteAgentSessionContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, NOT_FOUND: {} })
  .input(
    z.object({
      /** Agent kind. Optional while only one is registered. */
      kind: z.string().optional(),
      sessionId: z.string(),
    })
  )
  .output(z.object({ sessionId: z.string() }));

export const updateAgentSessionSettingsContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, NOT_FOUND: {}, BAD_REQUEST: {} })
  .input(
    z.object({
      /** Agent kind. Optional while only one is registered. */
      kind: z.string().optional(),
      sessionId: z.string(),
      title: z.string().max(200).optional(),
      modelId: z.string().optional(),
      thinkingLevel: thinkingLevelSchema.optional(),
      activeToolNames: z.array(z.string()).nullable().optional(),
      autoApprove: z.array(toolTierSchema).optional(),
      runtimeConfig: z.record(z.string(), z.unknown()).optional(),
    })
  )
  .output(agentSessionDetailSchema);

// ============================================
// Turns
// ============================================

/**
 * Enqueues a turn on the session's durable run and returns **immediately**.
 *
 * Deliberately not a streaming procedure. The turn is executed by a workflow run, so the HTTP
 * request that starts it does not need to stay open for minutes — and the turn survives a deploy
 * or restart, which an open request could not. Consume `agent.sessions.stream` for the output.
 */
export const promptAgentContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    BAD_REQUEST: {},
    CONFLICT: { message: "A turn is already running for this session." },
  })
  .input(
    z.object({
      /** Agent kind. Optional while only one is registered. */
      kind: z.string().optional(),
      sessionId: z.string(),
      text: z.string().min(1),
      /** Invoke a prompt template (slash command) instead of sending raw text. */
      template: z
        .object({ name: z.string(), args: z.array(z.string()).optional() })
        .optional(),
      /**
       * Tool names pre-authorised for this turn only — the "run and commit" affordance, which
       * skips the refusal handshake for the common path.
       */
      preAuthorizeToolNames: z.array(z.string()).optional(),
    })
  )
  .output(
    z.object({
      runId: z.string(),
      /**
       * Index to start streaming from to see this turn and nothing earlier. `-1` when the run's
       * stream is still empty.
       */
      startIndex: z.number(),
      /** True when this call started a new run rather than resuming the session's existing one. */
      startedRun: z.boolean(),
    })
  );

/**
 * Streams a run's events, replaying from `startIndex` before tailing live ones.
 *
 * Backed by the workflow run's durable stream, so this survives reconnects, restarts and multiple
 * concurrent viewers — the client just remembers the last index it saw.
 *
 * Token-level deltas live on a separate namespace (`deltas: true`) so a reconnecting client can
 * replay the coarse transcript cheaply and opt into the typing animation only if it wants it.
 */
export const streamAgentContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, NOT_FOUND: {} })
  .input(
    z.object({
      /** Agent kind. Optional while only one is registered. */
      kind: z.string().optional(),
      sessionId: z.string(),
      /** Defaults to the session's current run. */
      runId: z.string().optional(),
      /** Negative values read relative to the end, e.g. `-20` for the last 20 events. */
      startIndex: z.number().int().optional(),
      /** Include token-level deltas. Off by default — replay does not need them. */
      deltas: z.boolean().optional(),
    })
  )
  .output(eventIterator(agentWireEventSchema));

/**
 * TanStack AI compatibility facade.
 *
 * The client run remains request-scoped, while the runtime below it keeps using one durable,
 * multi-turn workflow. Only the newest prompt or approval decision crosses this boundary; the
 * server-owned session remains the source of truth for conversation history.
 */
export const chatAgentContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    BAD_REQUEST: {},
    CONFLICT: { message: "A turn is already running for this session." },
  })
  .input(
    z.object({
      /** Agent kind. Optional while only one is registered. */
      kind: z.string().optional(),
      sessionId: z.string(),
      /** Stable TanStack conversation id. */
      threadId: z.string(),
      /** Per-send TanStack run id; deliberately distinct from the workflow run id. */
      runId: z.string(),
      action: z.discriminatedUnion("type", [
        z.object({
          type: z.literal("prompt"),
          text: z.string().min(1),
        }),
        z.object({
          type: z.literal("approve"),
          toolCallId: z.string(),
          approved: z.boolean(),
          comment: z.string().max(1000).optional(),
        }),
      ]),
    })
  )
  .output(eventIterator(agentUiEventSchema));

export const abortAgentContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, NOT_FOUND: {} })
  .input(
    z.object({
      /** Agent kind. Optional while only one is registered. */
      kind: z.string().optional(),
      sessionId: z.string(),
    })
  )
  .output(z.object({ aborted: z.boolean() }));

export const steerAgentContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, NOT_FOUND: {} })
  .input(
    z.object({
      /** Agent kind. Optional while only one is registered. */
      kind: z.string().optional(),
      sessionId: z.string(),
      text: z.string().min(1),
      /**
       * `steer` interrupts the running turn; `followUp` waits for it to finish.
       * Named `queue` rather than `kind` — `kind` selects the *agent* kind on every procedure.
       */
      queue: z.enum(["steer", "followUp"]).optional(),
    })
  )
  .output(z.object({ queued: z.boolean() }));

export const approveAgentToolContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, NOT_FOUND: {} })
  .input(
    z.object({
      /** Agent kind. Optional while only one is registered. */
      kind: z.string().optional(),
      sessionId: z.string(),
      toolCallId: z.string(),
      approved: z.boolean(),
      comment: z.string().max(1000).optional(),
    })
  )
  .output(
    z.object({
      toolCallId: z.string(),
      approved: z.boolean(),
    })
  );

// ============================================
// Session maintenance
// ============================================

export const compactAgentSessionContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, NOT_FOUND: {}, CONFLICT: {} })
  .input(
    z.object({
      /** Agent kind. Optional while only one is registered. */
      kind: z.string().optional(),
      sessionId: z.string(),
      customInstructions: z.string().max(2000).optional(),
    })
  )
  .output(
    z.object({
      summary: z.string(),
      tokensBefore: z.number(),
    })
  );

/** Rewinds the session tree to an earlier entry so the agent can take another run at it. */
export const navigateAgentSessionContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, NOT_FOUND: {}, CONFLICT: {} })
  .input(
    z.object({
      /** Agent kind. Optional while only one is registered. */
      kind: z.string().optional(),
      sessionId: z.string(),
      entryId: z.string(),
      summarize: z.boolean().optional(),
      label: z.string().max(200).optional(),
    })
  )
  .output(
    z.object({
      cancelled: z.boolean(),
      events: z.array(agentWireEventSchema),
    })
  );

export const getAgentDraftContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {}, NOT_FOUND: {} })
  .input(
    z.object({
      /** Agent kind. Optional while only one is registered. */
      kind: z.string().optional(),
      sessionId: z.string(),
    })
  )
  .output(agentDraftSchema);

// ============================================
// Capabilities
// ============================================

export const listAgentModelsContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {} })
  .input(z.object({ kind: z.string().min(1) }))
  .output(
    z.array(
      z.object({
        providerId: z.string(),
        modelId: z.string(),
        name: z.string(),
        contextWindow: z.number(),
        supportsReasoning: z.boolean(),
        supportsImageInput: z.boolean(),
      })
    )
  );

/** Tools and slash commands, so the dashboard need not hard-code either list. */
export const listAgentCapabilitiesContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {} })
  .input(z.object({ kind: z.string().min(1) }))
  .output(
    z.object({
      tools: z.array(
        z.object({
          name: z.string(),
          label: z.string(),
          tier: toolTierSchema,
          description: z.string(),
        })
      ),
      promptTemplates: z.array(
        z.object({
          name: z.string(),
          description: z.string().optional(),
        })
      ),
      skills: z.array(z.object({ name: z.string(), description: z.string() })),
    })
  );

export type AgentSessionDetail = z.infer<typeof agentSessionDetailSchema>;
export type AgentSessionSummary = z.infer<typeof agentSessionSummarySchema>;
export type AgentDraftPayload = z.infer<typeof agentDraftSchema>;
