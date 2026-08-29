import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core";
import { withReplicas } from "drizzle-orm/pg-core";

import { switchEnv } from "@chia/utils/config";

import { env as internalEnv } from "./env.ts";
import { relations } from "./schemas/relations.ts";
import { storableCodecs } from "./storable.ts";

/**
 * The query surface repositories take. The driver's database *and* its transactions satisfy it,
 * so work that must run inside a transaction (see `withAgentSessionLock`) reuses the same
 * repositories on `tx`; nothing here reaches for the driver client.
 */
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
  // Keyed by URL *and* cache config: a `withCache: false` caller (workflow steps that
  // must never read stale rows) must not silently receive whichever connection was
  // created first.
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

  const connection = (async () =>
    drizzle(url, {
      relations,
      cache,
      codecs: storableCodecs,
    }))();
  connections.set(connectionKey, connection);

  try {
    return await connection;
  } catch (error) {
    connections.delete(connectionKey);
    console.error("Failed to create database connection:", error);
    throw error;
  }
}

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
