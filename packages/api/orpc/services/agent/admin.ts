import * as z from "zod";

import {
  effectiveKindConfig,
  effectiveKindDefaults,
  kindRowModel,
} from "@chia/agent-host/config";
import type { AgentKindDefinition } from "@chia/agent-host/kind";
import {
  AGENT_QUOTA_DEFAULTS,
  effectiveAgentQuota,
  isTimeZone,
} from "@chia/agent-host/quota";
import {
  assertAgentTaskModel,
  definedTaskParams,
  getAgentTaskDefinition,
  listAgentTaskDefinitions,
  listAgentTaskModels,
  taskRowModel,
} from "@chia/agent-host/tasks";
import type { AgentTaskDefinition } from "@chia/agent-host/tasks";
import { costToMicros, microsToUsd } from "@chia/agent-host/usage";
import { UnknownAgentModelError } from "@chia/agent-runtime/models";
import type { AgentModelRef } from "@chia/agent-runtime/models";
import type { ThinkingLevel } from "@chia/agent-runtime/types";
import type { DB } from "@chia/db/client";
import {
  getAgentQuotaConfig,
  listAgentKindConfigs,
  listAgentTaskConfigs,
  upsertAgentKindConfig,
  upsertAgentQuotaConfig,
  upsertAgentTaskConfig,
} from "@chia/db/repos/agent/config";
import type {
  AgentKindConfig,
  AgentQuotaConfig,
  AgentTaskConfig,
} from "@chia/db/schema";
import { AppError } from "@chia/service-kit/errors";
import type { JsonObject } from "@chia/utils/json";

import type {
  AgentKindAdmin,
  AgentQuotaAdmin,
  AgentTaskAdmin,
  AgentTaskParamsInput,
} from "../../contracts/agent-admin.contract";
import type { AgentModelInfo } from "../../contracts/agent.contract";

/**
 * Every write is checked against the definition it overrides before it lands, so a row
 * can only re-point what the code already allows.
 */

/** Per-call context. Admin-only by the route, so the caller is always the configured admin. */
export interface AgentAdminCaller {
  adminId: string;
  db: DB;
}

export interface AgentAdminService {
  listKinds(caller: AgentAdminCaller): Promise<AgentKindAdmin[]>;
  /** `NOT_FOUND` for an unregistered kind, `BAD_REQUEST` when a value fails the kind's policy. */
  updateKind(
    caller: AgentAdminCaller,
    input: {
      kind: string;
      model?: AgentModelRef | null;
      thinkingLevel?: string | null;
      autoApprove?: string[] | null;
      config?: JsonObject;
    }
  ): Promise<AgentKindAdmin>;

  listTasks(caller: AgentAdminCaller): Promise<AgentTaskAdmin[]>;
  /** `NOT_FOUND` for an unregistered task, `BAD_REQUEST` for a model off the house catalogue. */
  updateTask(
    caller: AgentAdminCaller,
    input: {
      id: string;
      model?: AgentModelRef | null;
      systemPrompt?: string | null;
      params?: Partial<AgentTaskParamsInput>;
    }
  ): Promise<AgentTaskAdmin>;
  listTaskModels(): Promise<AgentModelInfo[]>;

  getQuota(caller: AgentAdminCaller): Promise<AgentQuotaAdmin>;
  /** `BAD_REQUEST` for a zone the runtime does not know. */
  updateQuota(
    caller: AgentAdminCaller,
    input: {
      weeklyLimitUsd?: number | null;
      resetTimeZone?: string | null;
      maxRunningTurns?: number | null;
    }
  ): Promise<AgentQuotaAdmin>;
}

type LoadedKind = AgentKindDefinition<unknown, object>;

interface AgentDefinitionSource {
  kinds: readonly string[];
  load(kind: string): Promise<LoadedKind | undefined>;
}

const kindOrNotFound = async (
  source: AgentDefinitionSource,
  kind: string
): Promise<LoadedKind> => {
  const definition = await source.load(kind);
  if (!definition) {
    throw new AppError("NOT_FOUND", {
      message: `Agent kind "${kind}" is not registered.`,
    });
  }
  /* SAFETY: every registered kind's config is an object schema; `AgentKindConfigDefinition` says so. */
  return definition as LoadedKind;
};

const taskOrNotFound = (taskId: string): AgentTaskDefinition => {
  const definition = getAgentTaskDefinition(taskId);
  if (!definition) {
    throw new AppError("NOT_FOUND", {
      message: `Agent task "${taskId}" is not registered.`,
    });
  }
  return definition;
};

const badRequest = (message: string) =>
  new AppError("BAD_REQUEST", { message });

const kindView = (
  definition: LoadedKind,
  row: AgentKindConfig | undefined
): AgentKindAdmin => {
  const code = {
    providerId: definition.defaults.providerId,
    modelId: definition.defaults.modelId,
    thinkingLevel: definition.defaults.thinkingLevel ?? "off",
    autoApprove: definition.defaults.autoApprove ?? [],
  };
  const effective = effectiveKindDefaults(definition, row);
  return {
    kind: definition.kind,
    label: definition.label,
    description: definition.description,
    minTier: definition.minTier,
    defaults: {
      code,
      override: {
        model: kindRowModel(row),
        thinkingLevel:
          /* SAFETY: The admin write validated the column against the contract's enum. */ (row?.thinkingLevel as
            | ThinkingLevel
            | null
            | undefined) ?? null,
        autoApprove: row?.autoApprove ?? null,
      },
      effective: {
        providerId: effective.providerId,
        modelId: effective.modelId,
        thinkingLevel: effective.thinkingLevel ?? "off",
        autoApprove: effective.autoApprove ?? [],
      },
    },
    config: {
      /* SAFETY: JSON Schema is a JSON object. */
      schema: z.toJSONSchema(definition.config.schema) as JsonObject,
      /* SAFETY: a kind's config is validated by a JSON-compatible zod object schema. */
      defaults: definition.config.defaults as JsonObject,
      override: row?.config ?? {},
      /* SAFETY: as above. */
      effective: effectiveKindConfig(definition, row) as JsonObject,
    },
    updatedAt: row?.updatedAt.getTime() ?? null,
  };
};

const taskView = (
  definition: AgentTaskDefinition,
  row: AgentTaskConfig | undefined
): AgentTaskAdmin => {
  const override = taskRowModel(row);
  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    kind: definition.kind ?? null,
    model: {
      default: definition.defaultModel,
      override,
      effective: override ?? definition.defaultModel,
    },
    prompt: definition.prompt
      ? {
          default: definition.prompt.default,
          override: row?.systemPrompt ?? null,
        }
      : null,
    params: definition.params
      ? {
          default: definition.params,
          override: definedTaskParams(row?.params),
          effective: {
            ...definition.params,
            ...definedTaskParams(row?.params),
          },
        }
      : null,
    updatedAt: row?.updatedAt.getTime() ?? null,
  };
};

const quotaView = (row: AgentQuotaConfig | undefined): AgentQuotaAdmin => {
  const effective = effectiveAgentQuota(row);
  return {
    weeklyLimitUsd: {
      default: microsToUsd(AGENT_QUOTA_DEFAULTS.weeklyLimitMicros),
      override:
        row?.weeklyLimitMicros === null || row?.weeklyLimitMicros === undefined
          ? null
          : microsToUsd(row.weeklyLimitMicros),
      effective: microsToUsd(effective.weeklyLimitMicros),
    },
    resetTimeZone: {
      default: AGENT_QUOTA_DEFAULTS.resetTimeZone,
      override: row?.resetTimeZone ?? null,
      effective: effective.resetTimeZone,
    },
    maxRunningTurns: {
      default: AGENT_QUOTA_DEFAULTS.maxRunningTurns,
      override: row?.maxRunningTurns ?? null,
      effective: effective.maxRunningTurns,
    },
    updatedAt: row?.updatedAt.getTime() ?? null,
  };
};

/** A model the operator chose is checked by the kind: policy and catalogue membership at once. */
const assertKindModel = (definition: LoadedKind, ref: AgentModelRef): void => {
  try {
    definition.models.assert(ref);
  } catch (error) {
    throw error instanceof UnknownAgentModelError
      ? badRequest(error.message)
      : error;
  }
};

/** The tiers a kind's tools actually use are the only ones pre-approving means anything for. */
const assertKindTiers = (definition: LoadedKind, tiers: string[]): void => {
  const known = new Set(definition.capabilities().tools.map((t) => t.tier));
  const unknown = tiers.filter((tier) => !known.has(tier));
  if (unknown.length > 0) {
    throw badRequest(
      `Unknown tool tier${unknown.length > 1 ? "s" : ""} for "${definition.kind}": ${unknown.join(", ")}.`
    );
  }
};

const parseKindConfig = (
  definition: LoadedKind,
  config: JsonObject
): JsonObject => {
  const parsed = definition.config.schema.safeParse(config);
  if (!parsed.success) {
    throw badRequest(
      `Invalid configuration for "${definition.kind}": ${z.prettifyError(parsed.error)}`
    );
  }
  /* SAFETY: the schema is a JSON-compatible object schema; its output is a JSON object. */
  return parsed.data as JsonObject;
};

const assertTaskModel = (ref: AgentModelRef): void => {
  try {
    assertAgentTaskModel(ref);
  } catch (error) {
    throw error instanceof UnknownAgentModelError
      ? badRequest(
          `${error.message} A task runs on the house gateway; pick a model from its catalogue.`
        )
      : error;
  }
};

export const createAgentAdminService = (
  source: AgentDefinitionSource
): AgentAdminService => {
  const listKinds = async ({ db }: AgentAdminCaller) => {
    const rows = await listAgentKindConfigs(db);
    return Promise.all(
      source.kinds.map(async (kind) =>
        kindView(
          await kindOrNotFound(source, kind),
          rows.find((row) => row.kind === kind)
        )
      )
    );
  };

  const listTasks = async ({ db }: AgentAdminCaller) => {
    const rows = await listAgentTaskConfigs(db);
    return listAgentTaskDefinitions().map((definition) =>
      taskView(
        definition,
        rows.find((row) => row.taskId === definition.id)
      )
    );
  };

  return {
    listKinds,

    async updateKind({ db }, input) {
      const definition = await kindOrNotFound(source, input.kind);
      if (input.model) assertKindModel(definition, input.model);
      if (input.autoApprove) assertKindTiers(definition, input.autoApprove);
      const config =
        input.config === undefined
          ? undefined
          : parseKindConfig(definition, input.config);

      const row = await upsertAgentKindConfig(db, input.kind, {
        // A pair, set or cleared together; `undefined` leaves both alone.
        providerId: pairField(input.model, "providerId"),
        modelId: pairField(input.model, "modelId"),
        thinkingLevel: input.thinkingLevel,
        autoApprove: input.autoApprove,
        config,
      });
      return kindView(definition, row);
    },

    listTasks,

    async updateTask({ db }, input) {
      const definition = taskOrNotFound(input.id);
      if (input.model) assertTaskModel(input.model);
      if (input.systemPrompt !== undefined && !definition.prompt) {
        throw badRequest(`Task "${input.id}" has no prompt to override.`);
      }
      if (input.params !== undefined && !definition.params) {
        throw badRequest(`Task "${input.id}" has no parameters to override.`);
      }

      const row = await upsertAgentTaskConfig(db, input.id, {
        providerId: pairField(input.model, "providerId"),
        modelId: pairField(input.model, "modelId"),
        systemPrompt: input.systemPrompt,
        params: input.params,
      });
      return taskView(definition, row);
    },

    listTaskModels: () => Promise.resolve(listAgentTaskModels()),

    async getQuota({ db }) {
      return quotaView(await getAgentQuotaConfig(db));
    },

    async updateQuota({ db }, input) {
      if (input.resetTimeZone && !isTimeZone(input.resetTimeZone)) {
        throw badRequest(
          `"${input.resetTimeZone}" is not a time zone this runtime knows; use an IANA name such as Asia/Taipei.`
        );
      }
      const row = await upsertAgentQuotaConfig(db, {
        weeklyLimitMicros:
          input.weeklyLimitUsd === undefined
            ? undefined
            : input.weeklyLimitUsd === null
              ? null
              : costToMicros(input.weeklyLimitUsd),
        resetTimeZone: input.resetTimeZone,
        maxRunningTurns: input.maxRunningTurns,
      });
      return quotaView(row);
    },
  };
};

/** One half of a model pair patch: `undefined` leaves it, `null` clears it, a ref sets it. */
const pairField = (
  model: AgentModelRef | null | undefined,
  key: keyof AgentModelRef
): string | null | undefined =>
  model === undefined ? undefined : (model?.[key] ?? null);
