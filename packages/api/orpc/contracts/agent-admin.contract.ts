import { oc } from "@orpc/contract";
import * as z from "zod";

import {
  agentModelInfoSchema,
  agentModelRefSchema,
  thinkingLevelSchema,
} from "./agent.contract";

/**
 * Operator configuration of agent kinds and tasks. RPC-only and admin-only. Every view
 * carries `code`/`default`, `override` and `effective`, so the client never restates the
 * resolution rule.
 */

const errors = { UNAUTHORIZED: {}, FORBIDDEN: {}, SERVICE_UNAVAILABLE: {} };
const writeErrors = { ...errors, NOT_FOUND: {}, BAD_REQUEST: {} } as const;

const jsonObjectSchema = z.record(z.string(), z.json());

const sessionDefaultsSchema = z.object({
  providerId: z.string(),
  modelId: z.string(),
  thinkingLevel: thinkingLevelSchema,
  autoApprove: z.array(z.string()),
});

/** Each field `null` when the operator has not overridden it. */
const sessionDefaultsOverrideSchema = z.object({
  model: agentModelRefSchema.nullable(),
  thinkingLevel: thinkingLevelSchema.nullable(),
  autoApprove: z.array(z.string()).nullable(),
});

export const agentKindAdminSchema = z.object({
  kind: z.string(),
  label: z.string(),
  description: z.string(),
  /** `CallerTier` the kind admits; a number because the tier enum lives in service-kit. */
  minTier: z.number().int(),
  /** What a new session starts with when its creator chooses nothing. */
  defaults: z.object({
    code: sessionDefaultsSchema,
    override: sessionDefaultsOverrideSchema,
    effective: sessionDefaultsSchema,
  }),
  /** The kind's own configuration, shaped by `schema` (JSON Schema) for the form to render. */
  config: z.object({
    schema: jsonObjectSchema,
    defaults: jsonObjectSchema,
    override: jsonObjectSchema,
    effective: jsonObjectSchema,
  }),
  updatedAt: z.number().nullable(),
});

export const listAgentKindsAdminContract = oc
  .errors(errors)
  .output(z.array(agentKindAdminSchema));

/** `null` clears an override back to the code default; an absent key leaves it alone. */
export const updateAgentKindAdminContract = oc
  .errors(writeErrors)
  .input(
    z.object({
      kind: z.string().min(1),
      model: agentModelRefSchema.nullable().optional(),
      thinkingLevel: thinkingLevelSchema.nullable().optional(),
      autoApprove: z.array(z.string()).nullable().optional(),
      /** Replaces the whole override; validated by the kind's schema. `{}` clears it. */
      config: jsonObjectSchema.optional(),
    })
  )
  .output(agentKindAdminSchema);

/** `"session"`: the task runs on the model of the session it serves. */
const taskModelDefaultSchema = z.union([
  agentModelRefSchema,
  z.literal("session"),
]);

export const agentTaskParamsSchema = z.object({
  maxTokens: z.number().int().min(1).max(32_768),
  temperature: z.number().min(0).max(2),
});

export const TASK_PROMPT_MAX_CHARS = 20_000;

export const agentTaskAdminSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  /** The kind the task belongs to, or `null` for one every kind shares. */
  kind: z.string().nullable(),
  model: z.object({
    default: taskModelDefaultSchema,
    override: agentModelRefSchema.nullable(),
    effective: taskModelDefaultSchema,
  }),
  /** `null` for a task whose prompt is not the operator's to write (compaction uses Pi's own). */
  prompt: z
    .object({
      default: z.string(),
      override: z.string().nullable(),
    })
    .nullable(),
  /** `null` for a task whose call Pi shapes itself (compaction, branch summary). */
  params: z
    .object({
      default: agentTaskParamsSchema,
      override: agentTaskParamsSchema.partial(),
      effective: agentTaskParamsSchema,
    })
    .nullable(),
  updatedAt: z.number().nullable(),
});

export const listAgentTasksAdminContract = oc
  .errors(errors)
  .output(z.array(agentTaskAdminSchema));

/** `null` clears an override; an absent key leaves it alone; `params` replaces the whole override. */
export const updateAgentTaskAdminContract = oc
  .errors(writeErrors)
  .input(
    z.object({
      id: z.string().min(1),
      model: agentModelRefSchema.nullable().optional(),
      systemPrompt: z
        .string()
        .min(1)
        .max(TASK_PROMPT_MAX_CHARS)
        .nullable()
        .optional(),
      params: agentTaskParamsSchema.partial().optional(),
    })
  )
  .output(agentTaskAdminSchema);

/** The models a task may be pinned to: the house gateway's catalogue, no caller key involved. */
export const listAgentTaskModelsAdminContract = oc
  .errors(errors)
  .output(z.array(agentModelInfoSchema));

/**
 * Weekly house-spend limit for every caller below `Root`, and the zone its week is counted
 * in. Dollars on the wire; the row and the ledger keep micro-dollars.
 */
export const agentQuotaAdminSchema = z.object({
  weeklyLimitUsd: z.object({
    default: z.number(),
    override: z.number().nullable(),
    effective: z.number(),
  }),
  resetTimeZone: z.object({
    default: z.string(),
    override: z.string().nullable(),
    effective: z.string(),
  }),
  /** Turns one caller may have executing at once, across all their sessions. */
  maxRunningTurns: z.object({
    default: z.number().int(),
    override: z.number().int().nullable(),
    effective: z.number().int(),
  }),
  updatedAt: z.number().nullable(),
});

export const getAgentQuotaAdminContract = oc
  .errors(errors)
  .output(agentQuotaAdminSchema);

/** `null` clears an override back to the code default; an absent key leaves it alone. */
export const updateAgentQuotaAdminContract = oc
  .errors(writeErrors)
  .input(
    z.object({
      weeklyLimitUsd: z.number().min(0).max(10_000).nullable().optional(),
      /** An IANA zone name; the service validates it against the runtime's zone data. */
      resetTimeZone: z.string().min(1).max(100).nullable().optional(),
      maxRunningTurns: z.number().int().min(0).max(100).nullable().optional(),
    })
  )
  .output(agentQuotaAdminSchema);

export type AgentKindAdmin = z.infer<typeof agentKindAdminSchema>;
export type AgentQuotaAdmin = z.infer<typeof agentQuotaAdminSchema>;
export type AgentTaskAdmin = z.infer<typeof agentTaskAdminSchema>;
export type AgentTaskParamsInput = z.infer<typeof agentTaskParamsSchema>;
