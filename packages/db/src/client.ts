import { drizzle } from "drizzle-orm/node-postgres";
import { withReplicas } from "drizzle-orm/pg-core";

import { DrizzleCache } from "@chia/kv/drizzle/cache";
import { switchEnv } from "@chia/utils/config";

import { env as internalEnv } from "./env.ts";
import { relations } from "./schemas/relations.ts";

import type { DB } from ".";

const connections = new Map<string, Promise<DB>>();

export async function getConnection(url: string) {
  const existingConnection = connections.get(url);
  if (existingConnection) {
    return await existingConnection;
  }

  const connection = (async () =>
    drizzle(url, {
      relations,
      cache: new DrizzleCache(await import("@chia/kv").then((m) => m.kv), {
        strategy: "explicit",
        ttlMs: 60_000,
      }),
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

export const connectDatabase = async (env?: string): Promise<DB> => {
  return await switchEnv(env, {
    prod: async () =>
      internalEnv.DATABASE_URL_REPLICA_1
        ? withReplicas(await getConnection(internalEnv.DATABASE_URL), [
            await getConnection(internalEnv.DATABASE_URL_REPLICA_1),
          ])
        : await getConnection(internalEnv.DATABASE_URL ?? ""),
    beta: async () => await getConnection(internalEnv.BETA_DATABASE_URL ?? ""),
    local: async () =>
      await getConnection(internalEnv.LOCAL_DATABASE_URL ?? ""),
  });
};
