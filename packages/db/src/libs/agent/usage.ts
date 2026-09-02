import { and, desc, eq, gte, inArray, lt, sql, sum } from "drizzle-orm";

import type { DB } from "../../client.ts";
import { agentUsageLedger, user } from "../../schemas/schema.ts";
import type { AgentUsageSource } from "../../schemas/schema.ts";

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

/** One user's spend over `[from, to)`, in micro-dollars. `providerIds` selects which bills count (house gateway vs the user's own key). */
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

const periodConditions = (options: {
  from: Date;
  to: Date;
  providerIds?: readonly string[];
}) => [
  gte(agentUsageLedger.createdAt, options.from),
  lt(agentUsageLedger.createdAt, options.to),
  options.providerIds
    ? inArray(agentUsageLedger.providerId, [...options.providerIds])
    : undefined,
];

/**
 * Cache life of the site-wide aggregates. The ledger is written by the workflow process,
 * whose connection has no cache, so table invalidation never reaches these; the TTL is the
 * only staleness bound. Per-user reads stay uncached because a quota decision may follow.
 */
const AGGREGATE_CACHE_SECONDS = 60;

export interface AgentUsageSummary {
  costMicros: number;
  /** Ledger rows whose `source` is the turn itself; side jobs are not turns. */
  turns: number;
}

/** Spend and turn count over `[from, to)`, for one user or, without `userId`, everyone. */
export const summarizeAgentUsage = async (
  db: DB,
  options: {
    userId?: string;
    from: Date;
    to: Date;
    providerIds?: readonly string[];
  }
): Promise<AgentUsageSummary> => {
  const query = db
    .select({
      costMicros: sum(agentUsageLedger.costMicros),
      turns:
        sql<number>`count(*) filter (where ${agentUsageLedger.source} = 'turn')`.mapWith(
          Number
        ),
    })
    .from(agentUsageLedger)
    .where(
      and(
        options.userId
          ? eq(agentUsageLedger.userId, options.userId)
          : undefined,
        ...periodConditions(options)
      )
    );
  const [row] = await (options.userId
    ? query
    : query.$withCache({ config: { ex: AGGREGATE_CACHE_SECONDS } }));
  return { costMicros: Number(row?.costMicros ?? 0), turns: row?.turns ?? 0 };
};

export interface AgentUsageByUser extends AgentUsageSummary {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  isAnonymous: boolean;
}

/** The users who spent the most over `[from, to)`, highest first. */
export const listTopAgentUsageUsers = async (
  db: DB,
  options: {
    from: Date;
    to: Date;
    providerIds?: readonly string[];
    limit: number;
  }
): Promise<AgentUsageByUser[]> => {
  const costMicros = sum(agentUsageLedger.costMicros).as("cost_micros");
  const rows = await db
    .select({
      userId: agentUsageLedger.userId,
      name: user.name,
      email: user.email,
      image: user.image,
      isAnonymous: user.isAnonymous,
      costMicros,
      turns:
        sql<number>`count(*) filter (where ${agentUsageLedger.source} = 'turn')`.mapWith(
          Number
        ),
    })
    .from(agentUsageLedger)
    .innerJoin(user, eq(user.id, agentUsageLedger.userId))
    .where(and(...periodConditions(options)))
    .groupBy(
      agentUsageLedger.userId,
      user.name,
      user.email,
      user.image,
      user.isAnonymous
    )
    .orderBy(desc(costMicros))
    .limit(options.limit)
    .$withCache({ config: { ex: AGGREGATE_CACHE_SECONDS } });
  return rows.map((row) => ({
    ...row,
    isAnonymous: row.isAnonymous === true,
    costMicros: Number(row.costMicros ?? 0),
  }));
};
