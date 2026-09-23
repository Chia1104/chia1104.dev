import { getTableName } from "drizzle-orm";
import type { Table } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core";
import { withReplicas } from "drizzle-orm/pg-core";

import { reportError } from "@chia/observability/report";
import { switchEnv } from "@chia/utils/config";

import { env as internalEnv } from "./env.ts";
import { relations } from "./schemas/relations.ts";
import { storableCodecs } from "./storable.ts";

/** Query surface for repositories. The driver and its transactions both satisfy it, so `withAgentSessionLock` can reuse them on `tx`. */
export type DB = PgAsyncDatabase<NodePgQueryResultHKT, typeof relations>;

const connections = new Map<string, Promise<DB>>();

interface DrizzleCacheOptions {
  withCache?: boolean;
  cacheOptions?: {
    strategy?: "explicit" | "all";
    ttlMs?: number;
  };
}

export async function getConnection(
  url: string,
  options?: DrizzleCacheOptions
) {
  const {
    withCache = true,
    cacheOptions = { strategy: "explicit", ttlMs: 60_000 },
  } = options ?? {};
  // Cache config is part of the key so `withCache: false` never reuses a cached connection.
  const connectionKey = withCache
    ? `${url}#cache:${cacheOptions.strategy ?? "explicit"}:${cacheOptions.ttlMs ?? 60_000}`
    : `${url}#nocache`;
  const existingConnection = connections.get(connectionKey);
  if (existingConnection) {
    return await existingConnection;
  }

  const DrizzleCache = withCache
    ? await import("@chia/kv/drizzle/cache").then((m) => m.DrizzleCache)
    : undefined;
  const kv = withCache
    ? await import("@chia/kv/redis").then((m) => m.getRedisKv())
    : undefined;
  const cache =
    kv && DrizzleCache ? new DrizzleCache(kv, cacheOptions) : undefined;

  const connection = (async () => {
    const db = drizzle(url, {
      relations,
      cache,
      codecs: storableCodecs,
    });
    // pg-pool emits an idle client's error whether or not anyone listens; unhandled, it ends the process.
    db.$client.on("error", (error) => {
      reportError(error, "Idle database client failed");
    });
    return db;
  })();
  connections.set(connectionKey, connection);

  try {
    return await connection;
  } catch (error) {
    connections.delete(connectionKey);
    throw error;
  }
}

/**
 * Drops every cached query that read one of `tables`, from any process. For a write made on a
 * `withCache: false` connection: the cache is shared through Redis, but only a cached connection
 * invalidates on its own mutations, so a workflow step that writes a table the request path
 * caches calls this afterwards. A cache that cannot be reached leaves stale reads until they
 * expire, which is not worth failing the write for.
 */
export const invalidateCache = async (tables: Table[]): Promise<void> => {
  try {
    const [{ DrizzleCache }, { getRedisKv }] = await Promise.all([
      import("@chia/kv/drizzle/cache"),
      import("@chia/kv/redis"),
    ]);
    await new DrizzleCache(getRedisKv()).onMutate({ tables });
  } catch (error) {
    reportError(error, "Query cache could not be invalidated", {
      tables: tables.map((table) => getTableName(table)).join(","),
    });
  }
};

/** The primary connection string for `env`, for a connection outside the pool such as LISTEN. */
export const resolveDatabaseUrl = (env?: string): string =>
  switchEnv(env, {
    prod: () => internalEnv.DATABASE_URL,
    beta: () => internalEnv.BETA_DATABASE_URL ?? "",
    local: () => internalEnv.LOCAL_DATABASE_URL ?? "",
  });

export const connectDatabase = async (
  env?: string,
  options?: DrizzleCacheOptions
): Promise<DB> => {
  return await switchEnv(env, {
    prod: async () =>
      internalEnv.DATABASE_URL_REPLICA_1
        ? withReplicas(await getConnection(internalEnv.DATABASE_URL, options), [
            await getConnection(internalEnv.DATABASE_URL_REPLICA_1, options),
          ])
        : await getConnection(internalEnv.DATABASE_URL ?? "", options),
    beta: async () =>
      await getConnection(internalEnv.BETA_DATABASE_URL ?? "", options),
    local: async () =>
      await getConnection(internalEnv.LOCAL_DATABASE_URL ?? "", options),
  });
};
