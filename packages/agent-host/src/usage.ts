import { AGENT_PROVIDERS } from "@chia/agent-runtime/models";
import type { AgentCredentials } from "@chia/agent-runtime/models";
import type { AgentModelUsage } from "@chia/agent-runtime/types";
import type { DB } from "@chia/db/client";
import { insertAgentUsage } from "@chia/db/repos/agent/usage";
import type { AgentCredentialSource, AgentUsageSource } from "@chia/db/schema";

/**
 * Write side of the usage ledger: every provider call made for a user lands here, whoever
 * paid. Whether the spend is within a quota is decided where a turn is accepted.
 */

const MICROS_PER_USD = 1_000_000;

/** pi reports cost in dollars as a float; the ledger keeps an integer so a running sum cannot drift. */
export const costToMicros = (usd: number): number => {
  if (!Number.isFinite(usd) || usd < 0) {
    throw new RangeError("USD cost must be finite and non-negative");
  }
  const micros = Math.round(usd * MICROS_PER_USD);
  if (!Number.isSafeInteger(micros)) {
    throw new RangeError("USD cost exceeds the safe micro-dollar range");
  }
  return micros;
};

export const microsToUsd = (micros: number): number => micros / MICROS_PER_USD;

/**
 * Whose key a call ran on. `providerId` is the provider pi reported; a native provider is
 * registered only with the caller's key, and a gateway call is theirs only if they brought a
 * gateway key.
 */
export const credentialSourceOf = (
  credentials: AgentCredentials,
  providerId: string
): AgentCredentialSource => {
  if (providerId !== AGENT_PROVIDERS.gateway) return "byok-native";
  return credentials.gateway ? "byok-gateway" : "house";
};

export interface RecordAgentUsageInput extends AgentModelUsage {
  userId: string;
  sessionId?: string | null;
  runId?: string | null;
  entryId?: string | null;
  kind: string;
  source: AgentUsageSource;
  credentialSource: AgentCredentialSource;
}

/**
 * Lands one provider call in the ledger. Never throws: the row is written after the work it
 * accounts for has already happened, so a failed write must not fail the turn. A call the
 * provider did not bill is not a row.
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
      credentialSource: input.credentialSource,
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
