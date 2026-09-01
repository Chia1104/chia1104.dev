import { asyncIteratorObject, oc } from "@orpc/contract";
import * as z from "zod";

import { agentWireEventSchema } from "@chia/agent-runtime/wire/schema";
import { locale } from "@chia/db/schema/enums";

import { withMetaSchema } from "./shared";

/** Kind-specific fields stay optional; the runtime selected by `agent.session.kind` owns their validation. */

/**
 * Quota refusal is not an oRPC common code; the RPC handler's `errorStatusMap` owns its
 * HTTP status. `resetAt` is when the week turns over.
 */
export const agentQuotaExceededSchema = z.object({
  limitMicros: z.number(),
  usedMicros: z.number(),
  resetAt: z.string(),
  timeZone: z.string(),
});

export const quotaExceededError = {
  QUOTA_EXCEEDED: { data: agentQuotaExceededSchema },
} as const;

/** Refuses a new turn while the caller already has their cap of turns executing. */
export const agentTurnCapSchema = z.object({
  runningTurns: z.number().int(),
  maxRunningTurns: z.number().int(),
});

export const turnCapError = {
  TOO_MANY_REQUESTS: { data: agentTurnCapSchema },
} as const;

/**
 * `exempt` is the operator: `limitMicros` and `maxRunningTurns` are `null`, but spend and
 * running turns are still reported.
 */
export const agentUsageStandingSchema = z.object({
  exempt: z.boolean(),
  /** Micro-dollars of house spend allowed per period; `null` when exempt. */
  limitMicros: z.number().nullable(),
  usedMicros: z.number(),
  /** ISO instants; `end` is when the allowance is whole again. */
  period: z.object({ start: z.string(), end: z.string() }),
  timeZone: z.string(),
  runningTurns: z.number().int(),
  maxRunningTurns: z.number().int().nullable(),
});

export type AgentUsageStanding = z.infer<typeof agentUsageStandingSchema>;

export const thinkingLevelSchema = z.enum([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

/**
 * Tiers are per-kind policy, so the contract carries a string rather than a union. Narrowing
 * lives in each kind's package.
 */
const toolTierSchema = z.string();

/**
 * `(providerId, modelId)` together so a caller cannot send a model id with no provider.
 * Inferring the missing half would silently decide whose account pays. Existence is
 * per-kind policy.
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
  forkedFromSessionId: z.string().nullable().optional(),
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
   * Live durable run, or `null`. `running` is a turn executing; `waiting` is parked on a
   * message or approval hook.
   */
  run: z
    .object({
      id: z.string(),
      status: z.enum(["running", "waiting"]),
    })
    .nullable(),
  /**
   * Transcript as wire events so the client uses the same reducer as the live stream. While a
   * turn runs it stops before that turn; `chat` `{ type: "attach" }` replays from its start.
   */
  events: z.array(agentWireEventSchema),
  /**
   * Every approval row. The transcript never replays approval events, so the client re-applies
   * these.
   */
  approvals: z.array(
    z.object({
      toolCallId: z.string(),
      toolName: z.string(),
      args: z.unknown().optional(),
      status: z.enum(["pending", "approved", "rejected"]),
      comment: z.string().optional(),
    })
  ),
  stats: z.object({
    messageCount: z.number(),
    /** Estimated tokens the next provider request will carry on the active branch. */
    contextTokens: z.number().int().nonnegative(),
    /**
     * Whether `compact` would condense anything. A short conversation has nothing to summarise
     * and `compact` refuses it.
     */
    compactable: z.boolean(),
    /** Every token processed by provider and compaction calls across the session. */
    totalTokens: z.number(),
    costTotal: z.number(),
  }),
});

/** The caller's own standing. Any session-bearing tier, guests included; nothing kind-specific. */
export const getAgentUsageContract = oc
  .errors({ UNAUTHORIZED: {}, SERVICE_UNAVAILABLE: {} })
  .output(agentUsageStandingSchema);

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

/**
 * One prompt or approval in; that turn's wire events out. The message is enqueued durably
 * first, then this request tails the stream — a dropped connection loses the view, never
 * the turn.
 */
export const chatAgentContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    BAD_REQUEST: {},
    /** An undecided approval blocks the next message, and a just-started run needs a retry. */
    CONFLICT: {},
    ...quotaExceededError,
    ...turnCapError,
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
          type: z.literal("command"),
          name: z.string().min(1).max(100),
          args: z.array(z.string()).max(32),
          text: z.string().min(1),
        }),
        z.object({
          type: z.literal("approve"),
          toolCallId: z.string(),
          approved: z.boolean(),
          comment: z.string().max(1000).optional(),
        }),
        /**
         * Rejoin the running turn from its start. Enqueues nothing; NOT_FOUND when no turn is
         * running.
         */
        z.object({ type: z.literal("attach") }),
      ]),
    })
  )
  .output(asyncIteratorObject(agentWireEventSchema));

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
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    ...quotaExceededError,
    ...turnCapError,
  })
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

/**
 * Summarises the older part of the active branch. `CONFLICT` while a turn runs, an approval
 * is undecided, or `stats.compactable` is false. `TIMEOUT` leaves the conversation unchanged.
 */
export const compactAgentSessionContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    CONFLICT: {},
    TIMEOUT: {},
    ...quotaExceededError,
  })
  .input(
    z.object({
      /** Agent kind. Optional while only one is registered. */
      kind: z.string().optional(),
      sessionId: z.string(),
      customInstructions: z.string().max(2000).optional(),
    })
  )
  .output(agentSessionDetailSchema);

/**
 * Rewinds in place to `entryId` (a transcript message id). `CONFLICT` while a turn runs or
 * an approval is undecided. `TIMEOUT` leaves the leaf unmoved.
 */
export const navigateAgentSessionContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    CONFLICT: {},
    TIMEOUT: {},
    ...quotaExceededError,
  })
  .input(
    z.object({
      /** Agent kind. Optional while only one is registered. */
      kind: z.string().optional(),
      sessionId: z.string(),
      entryId: z.string(),
      /** Summarise the branch left behind under the new leaf, so the model keeps the gist. */
      summarize: z.boolean().optional(),
      label: z.string().max(200).optional(),
    })
  )
  .output(agentSessionDetailSchema);

/**
 * Copies into a new session. With `entryId`, `before` a user message stops at its parent;
 * `at` includes the target. Kind state is copied as it stands now.
 */
export const forkAgentSessionContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    BAD_REQUEST: {},
    CONFLICT: {},
  })
  .input(
    z.object({
      /** Agent kind. Optional while only one is registered. */
      kind: z.string().optional(),
      sessionId: z.string(),
      entryId: z.string().optional(),
      position: z.enum(["before", "at"]).optional(),
      title: z.string().max(200).optional(),
    })
  )
  .output(agentSessionDetailSchema);

export const agentModelInfoSchema = z.object({
  providerId: z.string(),
  modelId: z.string(),
  name: z.string(),
  contextWindow: z.number(),
  supportsReasoning: z.boolean(),
  supportsImageInput: z.boolean(),
  /**
   * True when the provider needs a caller key that is not registered yet. Still listed so
   * the picker can prompt for a key.
   */
  requiresApiKey: z.boolean(),
});

export const listAgentModelsContract = oc
  .errors({ UNAUTHORIZED: {}, FORBIDDEN: {} })
  .input(z.object({ kind: z.string().min(1) }))
  .output(z.array(agentModelInfoSchema));

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
      commands: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          argumentHint: z.string().optional(),
        })
      ),
      skills: z.array(z.object({ name: z.string(), description: z.string() })),
    })
  );

export type AgentModelInfo = z.infer<typeof agentModelInfoSchema>;
export type AgentSessionDetail = z.infer<typeof agentSessionDetailSchema>;
export type AgentSessionSummary = z.infer<typeof agentSessionSummarySchema>;
export type AgentDraftPayload = z.infer<typeof agentDraftSchema>;
