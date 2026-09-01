import { eq } from "drizzle-orm";

import type { JsonObject } from "@chia/utils/json";

import type { DB } from "../../client.ts";
import {
  AGENT_QUOTA_CONFIG_ID,
  agentKindConfigs,
  agentQuotaConfigs,
  agentTaskConfigs,
} from "../../schemas/schema.ts";
import type {
  AgentKindConfig,
  AgentQuotaConfig,
  AgentTaskConfig,
  AgentTaskParams,
} from "../../schemas/schema.ts";

/** Absent keys are left alone, `null` clears; a missing row is inserted. */

export interface UpsertAgentKindConfigDTO {
  providerId?: string | null;
  modelId?: string | null;
  thinkingLevel?: string | null;
  autoApprove?: string[] | null;
  config?: JsonObject;
}

export const getAgentKindConfig = async (
  db: DB,
  kind: string
): Promise<AgentKindConfig | undefined> =>
  await db.query.agentKindConfigs.findFirst({ where: { kind } });

export const listAgentKindConfigs = async (
  db: DB
): Promise<AgentKindConfig[]> => await db.select().from(agentKindConfigs);

export const upsertAgentKindConfig = async (
  db: DB,
  kind: string,
  patch: UpsertAgentKindConfigDTO
): Promise<AgentKindConfig> => {
  const set = definedEntries(patch);
  const [row] = await db
    .insert(agentKindConfigs)
    .values({ kind, ...set })
    .onConflictDoUpdate({
      target: agentKindConfigs.kind,
      set: Object.keys(set).length > 0 ? set : { kind },
    })
    .returning();
  if (!row) throw new Error(`Kind config for "${kind}" was not written.`);
  return row;
};

export interface UpsertAgentTaskConfigDTO {
  providerId?: string | null;
  modelId?: string | null;
  systemPrompt?: string | null;
  params?: AgentTaskParams;
}

export const getAgentTaskConfig = async (
  db: DB,
  taskId: string
): Promise<AgentTaskConfig | undefined> =>
  await db.query.agentTaskConfigs.findFirst({ where: { taskId } });

export const listAgentTaskConfigs = async (
  db: DB
): Promise<AgentTaskConfig[]> => await db.select().from(agentTaskConfigs);

export const upsertAgentTaskConfig = async (
  db: DB,
  taskId: string,
  patch: UpsertAgentTaskConfigDTO
): Promise<AgentTaskConfig> => {
  const set = definedEntries(patch);
  const [row] = await db
    .insert(agentTaskConfigs)
    .values({ taskId, ...set })
    .onConflictDoUpdate({
      target: agentTaskConfigs.taskId,
      set: Object.keys(set).length > 0 ? set : { taskId },
    })
    .returning();
  if (!row) throw new Error(`Task config for "${taskId}" was not written.`);
  return row;
};

export const deleteAgentTaskConfig = async (
  db: DB,
  taskId: string
): Promise<void> => {
  await db.delete(agentTaskConfigs).where(eq(agentTaskConfigs.taskId, taskId));
};

export interface UpsertAgentQuotaConfigDTO {
  weeklyLimitMicros?: number | null;
  resetTimeZone?: string | null;
  maxRunningTurns?: number | null;
}

export const getAgentQuotaConfig = async (
  db: DB
): Promise<AgentQuotaConfig | undefined> =>
  await db.query.agentQuotaConfigs.findFirst({
    where: { id: AGENT_QUOTA_CONFIG_ID },
  });

export const upsertAgentQuotaConfig = async (
  db: DB,
  patch: UpsertAgentQuotaConfigDTO
): Promise<AgentQuotaConfig> => {
  const set = definedEntries(patch);
  const [row] = await db
    .insert(agentQuotaConfigs)
    .values({ id: AGENT_QUOTA_CONFIG_ID, ...set })
    .onConflictDoUpdate({
      target: agentQuotaConfigs.id,
      set: Object.keys(set).length > 0 ? set : { id: AGENT_QUOTA_CONFIG_ID },
    })
    .returning();
  if (!row) throw new Error("Quota config was not written.");
  return row;
};

/** The keys the caller chose to write; `undefined` means "leave it", so it must not reach SQL. */
const definedEntries = <T extends object>(patch: T): Partial<T> => {
  const set: Partial<T> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) Object.assign(set, { [key]: value });
  }
  return set;
};
