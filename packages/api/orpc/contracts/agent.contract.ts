import { eventIterator, oc } from "@orpc/contract";
import * as z from "zod";

import { agentWireEventSchema } from "@chia/agent-runtime/wire/schema";
import { locale } from "@chia/db/schema/enums";

import { withMetaSchema } from "./shared";

/**
 * Shared agent transport contract.
 *
 * Kind-specific fields stay optional; the runtime selected by `agent_session.kind` owns
 * their validation.
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
 * Tiers are per-kind policy, so the contract carries the string rather than a union. `@chia/agent-runtime`
 * deliberately keeps `ToolTier` open for the same reason — narrowing lives in each kind's package.
 */
const toolTierSchema = z.string();

/**
 * Model identity: the `(providerId, modelId)` pair, always together.
 *
 * One nested object rather than two sibling optionals, so "a model id with no provider" is not a
 * state a caller can express. The same model carries different ids under different providers
 * (`anthropic/claude-haiku-4.5` through a gateway is `claude-haiku-4-5` natively), and inferring the
 * missing half would silently decide whose account pays. Whether the pair actually *exists* is
 * per-kind policy, checked by the runtime — see `agentSessionGuard`.
 */
export const agentModelRefSchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
});

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
  runtimeConfig: z.record(z.string(), z.json()).optional(),
  configVersion: z.number().int().positive().optional(),
  /** Optional runtime-owned state for kinds that do not have a dedicated public contract yet. */
  state: z.unknown().optional(),
  /** Writing-agent state. Other kinds expose their own state contract. */
  draft: agentDraftSchema.optional(),
  /**
   * The session's live durable run, or `null` when none is alive. `running` means a turn step is
   * executing right now; `waiting` means the run is parked on its message or approval hook.
   */
  run: z
    .object({
      id: z.string(),
      status: z.enum(["running", "waiting"]),
    })
    .nullable(),
  /**
   * The transcript replayed as wire events, so the client folds it with the exact same reducer it
   * uses for the live stream. While a turn is running it stops before that turn; `chat` with
   * `{ type: "attach" }` replays the running turn from its start and tails it live.
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
      model: agentModelRefSchema.optional(),
      thinkingLevel: thinkingLevelSchema.optional(),
      autoApprove: z.array(toolTierSchema).optional(),
      runtimeConfig: z.record(z.string(), z.json()).optional(),
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
      model: agentModelRefSchema.optional(),
      thinkingLevel: thinkingLevelSchema.optional(),
      activeToolNames: z.array(z.string()).nullable().optional(),
      autoApprove: z.array(toolTierSchema).optional(),
      runtimeConfig: z.record(z.string(), z.json()).optional(),
    })
  )
  .output(agentSessionDetailSchema);

// ============================================
// Turns
// ============================================

/**
 * The turn transport: one prompt or approval decision in, that turn's wire events out.
 *
 * The request is scoped to one turn, while the runtime below it keeps using one durable,
 * multi-turn workflow: the message is enqueued durably first and this request then tails the
 * run's stream from that point, so a dropped connection loses the view, never the turn — the
 * transcript is replayed from the server-owned session on the next `get`. Only the newest
 * prompt or approval decision crosses this boundary; the server owns conversation history.
 * The stream carries the same `AgentWireEvent`s `get` replays, so one client reducer folds both.
 */
export const chatAgentContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    BAD_REQUEST: {},
  })
  .input(
    z.object({
      /** Agent kind. Optional while only one is registered. */
      kind: z.string().optional(),
      sessionId: z.string(),
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
        /**
         * Rejoin the turn that is running right now, replayed from its start. Enqueues nothing;
         * NOT_FOUND when no turn is running.
         */
        z.object({ type: z.literal("attach") }),
      ]),
    })
  )
  .output(eventIterator(agentWireEventSchema));

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
        /**
         * True when the provider runs on a caller-supplied key the caller has not registered yet.
         * Such models are still listed — the picker offers them and prompts for a key, rather than
         * hiding an option the operator could have had.
         */
        requiresApiKey: z.boolean(),
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
