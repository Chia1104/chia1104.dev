import type {
  AgentSessionDefaults,
  ThinkingLevel,
} from "@chia/agent-runtime/types";
import type { DB } from "@chia/db/client";
import { getAgentKindConfig } from "@chia/db/repos/agent/config";
import type { AgentKindConfig } from "@chia/db/schema";

import type { AgentKindDefinition } from "./kind";

/**
 * A kind's effective configuration: the operator's `agent.kind_config` row over the definition.
 *
 * Read wherever the code's value used to be read — session creation for the defaults, the turn
 * step for the kind config — so a change in the dashboard reaches the next session or turn
 * without a deploy, and nothing is cached in the process.
 */

export interface EffectiveKindConfig<TConfig> {
  defaults: AgentSessionDefaults;
  config: TConfig;
  row: AgentKindConfig | undefined;
}

export const loadKindConfig = async <TConfig extends object>(
  db: DB,
  definition: AgentKindDefinition<unknown, TConfig>
): Promise<EffectiveKindConfig<TConfig>> => {
  const row = await getAgentKindConfig(db, definition.kind);
  return {
    defaults: effectiveKindDefaults(definition, row),
    config: effectiveKindConfig(definition, row),
    row,
  };
};

/** The row's model pair, or nothing; the admin write sets both columns or neither. */
export const kindRowModel = (
  row: Pick<AgentKindConfig, "providerId" | "modelId"> | undefined
) =>
  row?.providerId && row.modelId
    ? { providerId: row.providerId, modelId: row.modelId }
    : null;

export const effectiveKindDefaults = (
  definition: Pick<AgentKindDefinition<unknown, object>, "defaults">,
  row: AgentKindConfig | undefined
): AgentSessionDefaults => {
  const model = kindRowModel(row);
  return {
    providerId: model?.providerId ?? definition.defaults.providerId,
    modelId: model?.modelId ?? definition.defaults.modelId,
    thinkingLevel:
      /* SAFETY: The admin write validated the column against the contract's enum. */ (row?.thinkingLevel as
        | ThinkingLevel
        | null
        | undefined) ?? definition.defaults.thinkingLevel,
    autoApprove: row?.autoApprove ?? definition.defaults.autoApprove,
  };
};

/**
 * The row's `config` over the definition's defaults, re-validated on read: the schema is the
 * deployment's and the row may predate it. A row the schema rejects is reported and ignored
 * rather than half-applied, so a turn never runs on a config the kind did not accept.
 */
export const effectiveKindConfig = <TConfig extends object>(
  definition: Pick<AgentKindDefinition<unknown, TConfig>, "kind" | "config">,
  row: AgentKindConfig | undefined
): TConfig => {
  if (!row) return definition.config.defaults;
  const parsed = definition.config.schema.safeParse({
    ...definition.config.defaults,
    ...row.config,
  });
  if (parsed.success) return parsed.data;
  console.warn(
    `Agent kind "${definition.kind}" has a configuration its schema rejects; using defaults.`,
    parsed.error.issues
  );
  return definition.config.defaults;
};
