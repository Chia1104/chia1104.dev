import type { AgentModelUsage } from "@chia/agent-runtime/types";
import type { DB } from "@chia/db/client";
import { insertAgentUsage } from "@chia/db/repos/agent/usage";
import type { AgentUsageSource } from "@chia/db/schema";

/**
 * The write side of the usage ledger: every provider call made for a user lands here, whoever
 * paid for it — the house gateway or a key the user brought. The ledger records; whether the
 * spend is within a quota is decided where a turn is accepted, and by the tier's own policy.
 */

/** pi reports cost in dollars as a float; the ledger keeps an integer so a running sum cannot drift. */
export const costToMicros = (usd: number): number =>
  Math.round(usd * 1_000_000);

export interface RecordAgentUsageInput extends AgentModelUsage {
  /** The user the call was made for — the session's owner, not who paid. */
  userId: string;
  sessionId?: string | null;
  runId?: string | null;
  entryId?: string | null;
  kind: string;
  source: AgentUsageSource;
}

/**
 * Lands one provider call in the ledger.
 *
 * Never throws: the row is written after the work it accounts for has already happened, so a
 * failed write cannot undo anything and must not fail the turn or side job it rides beside. The
 * loss is bounded to that one call and falls in the user's favour. A call the provider did not
 * bill — a failed request, a stubbed reply — is not a row.
 */
export const recordAgentUsage = async (
  db: DB,
  input: RecordAgentUsageInput
): Promise<void> => {
  const { usage } = input;
  if (usage.totalTokens === 0 && usage.cost.total === 0) return;
  try {
    await insertAgentUsage(db, {
      userId: input.userId,
      sessionId: input.sessionId,
      runId: input.runId,
      entryId: input.entryId,
      kind: input.kind,
      source: input.source,
      providerId: input.providerId,
      modelId: input.modelId,
      input: usage.input,
      output: usage.output,
      cacheRead: usage.cacheRead,
      cacheWrite: usage.cacheWrite,
      reasoning: usage.reasoning ?? null,
      costMicros: costToMicros(usage.cost.total),
    });
  } catch (error) {
    console.error("Could not record agent usage", {
      userId: input.userId,
      sessionId: input.sessionId,
      source: input.source,
      error: String(error),
    });
  }
};
