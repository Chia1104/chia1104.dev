import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core";
import { withReplicas } from "drizzle-orm/pg-core";

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
