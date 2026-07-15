import { drizzle } from "drizzle-orm/node-postgres";
import { withReplicas } from "drizzle-orm/pg-core";

import { switchEnv } from "@chia/utils/config";

import { env as internalEnv } from "./env.ts";
import { relations } from "./schemas/relations.ts";

import type { DB } from ".";

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
  const existingConnection = connections.get(url);
  if (existingConnection) {
    return await existingConnection;
  }

  const DrizzleCache = withCache
    ? await import("@chia/kv/drizzle/cache").then((m) => m.DrizzleCache)
    : undefined;
  const kv = withCache ? await import("@chia/kv").then((m) => m.kv) : undefined;
  const cache =
    kv && DrizzleCache ? new DrizzleCache(kv, cacheOptions) : undefined;

  const connection = (async () =>
    drizzle(url, {
      relations,
      cache,
    }))();
  connections.set(url, connection);

  try {
    return await connection;
  } catch (error) {
    connections.delete(url);
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
            await getConnection(internalEnv.DATABASE_URL_REPLICA_1),
          ])
        : await getConnection(internalEnv.DATABASE_URL ?? "", options),
    beta: async () =>
      await getConnection(internalEnv.BETA_DATABASE_URL ?? "", options),
    local: async () =>
      await getConnection(internalEnv.LOCAL_DATABASE_URL ?? "", options),
  });
};
