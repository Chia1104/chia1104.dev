import { AgentProvider } from "@chia/agent-runtime/models";
import type { AgentCredentials } from "@chia/agent-runtime/models";
import type {
  AgentModelUsage,
  AgentUsageListener,
} from "@chia/agent-runtime/types";
import type { DB } from "@chia/db/client";
import { insertAgentUsage } from "@chia/db/repos/agent/usage";
import { AgentCredentialSource } from "@chia/db/schema";
import type { AgentUsageSource } from "@chia/db/schema";
import { reportError } from "@chia/observability/report";

/**
 * Write side of the usage ledger: every provider call made for a user lands here, whoever
 * paid. Whether the spend is within a quota is decided where a turn is accepted.
 */

const MICROS_PER_USD = 1_000_000;

/** The ledger's `kind` for a one-shot task on a post (summary, report triage); it belongs to no agent kind. */
export const FEED_TASK_USAGE_KIND = "feed";

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
  if (providerId !== AgentProvider.Gateway) {
    return AgentCredentialSource.ByokNative;
  }
  return credentials.gateway
    ? AgentCredentialSource.ByokGateway
    : AgentCredentialSource.House;
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
    // Best-effort: the call already happened; losing its row errs in the user's favor.
    reportError(error, "Could not record agent usage", {
      userId: input.userId,
      sessionId: input.sessionId,
      source: input.source,
    });
  }
};

/**
 * Meters every call on a session's tree (turns, compaction, branch summaries) against the key it
 * ran on. `db` must outlive any transaction the work runs in: a call that is rolled back was
 * still billed.
 */
export const sessionUsageListener =
  (
    db: DB,
    session: {
      userId: string;
      sessionId: string;
      kind: string;
      runId?: string;
      /** The keys the call for `source` ran on; a task pinned to a house model carries none. */
      credentialsFor: (source: AgentUsageSource) => AgentCredentials;
    }
  ): AgentUsageListener =>
  (report) =>
    recordAgentUsage(db, {
      userId: session.userId,
      sessionId: session.sessionId,
      runId: session.runId,
      kind: session.kind,
      credentialSource: credentialSourceOf(
        session.credentialsFor(report.source),
        report.providerId
      ),
      ...report,
    });
