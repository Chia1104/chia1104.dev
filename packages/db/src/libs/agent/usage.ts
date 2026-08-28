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
