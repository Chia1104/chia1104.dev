import { eq } from "drizzle-orm";

import type { JsonObject } from "@chia/utils/json";

import type { DB } from "../../client.ts";
import { agentKindConfigs, agentTaskConfigs } from "../../schemas/schema.ts";
import type {
  AgentKindConfig,
  AgentTaskConfig,
  AgentTaskParams,
} from "../../schemas/schema.ts";

/**
 * Operator configuration rows for agent kinds and tasks.
 *
 * Both tables are keyed by a registry name the host owns, and both are patched with the same
 * rule as `updateAgentSession`: a key that is absent is left alone, `null` clears it. A patch
 * against a row that does not exist inserts it, so the caller never has to know whether the
 * operator has touched this kind or task before.
 */

// ============================================
// Kinds
// ============================================

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

// ============================================
// Tasks
// ============================================

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

/** The keys the caller chose to write; `undefined` means "leave it", so it must not reach SQL. */
const definedEntries = <T extends object>(patch: T): Partial<T> => {
  const set: Partial<T> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) Object.assign(set, { [key]: value });
  }
  return set;
};
