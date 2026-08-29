import { and, eq, gte, inArray, lt, sum } from "drizzle-orm";

import type { DB } from "../../client.ts";
import { agentUsageLedger } from "../../schemas/schema.ts";
import type { AgentUsageSource } from "../../schemas/schema.ts";

/**
 * The usage ledger: one row per provider call made for a user. Reads for quotas and the
 * dashboard attach here beside the write.
 */

export interface InsertAgentUsageDTO {
  userId: string;
  sessionId?: string | null;
  runId?: string | null;
  entryId?: string | null;
  kind: string;
  source: AgentUsageSource;
  providerId: string;
  modelId: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning?: number | null;
  costMicros: number;
}

export const insertAgentUsage = async (db: DB, input: InsertAgentUsageDTO) => {
  const [row] = await db
    .insert(agentUsageLedger)
    .values({
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      runId: input.runId ?? null,
      entryId: input.entryId ?? null,
      kind: input.kind,
      source: input.source,
      providerId: input.providerId,
      modelId: input.modelId,
      input: input.input,
      output: input.output,
      cacheRead: input.cacheRead,
      cacheWrite: input.cacheWrite,
      reasoning: input.reasoning ?? null,
      costMicros: input.costMicros,
    })
    .returning();
  return row;
};

/**
 * One user's spend over `[from, to)`, in micro-dollars. `providerIds` narrows it to the bills
 * that count — a quota on house spend passes the gateway alone, so a call the user's own key
 * paid for is recorded but not charged against them.
 */
export const sumAgentUsageCost = async (
  db: DB,
  options: {
    userId: string;
    from: Date;
    to: Date;
    providerIds?: readonly string[];
  }
): Promise<number> => {
  const conditions = [
    eq(agentUsageLedger.userId, options.userId),
    gte(agentUsageLedger.createdAt, options.from),
    lt(agentUsageLedger.createdAt, options.to),
  ];
  if (options.providerIds) {
    conditions.push(
      inArray(agentUsageLedger.providerId, [...options.providerIds])
    );
  }
  const [row] = await db
    .select({ total: sum(agentUsageLedger.costMicros) })
    .from(agentUsageLedger)
    .where(and(...conditions));
  return Number(row?.total ?? 0);
};
