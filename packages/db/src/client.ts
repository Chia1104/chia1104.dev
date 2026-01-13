import { drizzle } from "drizzle-orm/node-postgres";
import { withReplicas } from "drizzle-orm/pg-core";
import pg from "pg";

import { DrizzleCache } from "@chia/kv/drizzle/cache";
import { switchEnv } from "@chia/utils/config";

import type { DB } from ".";
import { env as _env } from "./env";
import * as schemas from "./schemas";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: DB | null = null;

export async function getConnection(url: string) {
  // Check if pool exists and token is still valid
  if (db) {
    return db;
  }

  // Token is expired or pool is null, recreate pool and db
  try {
    await closeConnection();

    const kv = await import("@chia/kv").then((m) => m.kv);

    pool = new Pool({
      connectionString: url,
      connectionTimeoutMillis: 10_000,
    });
    db = drizzle(pool, {
      schema: schemas,
      cache: new DrizzleCache(kv, {
        strategy: "all",
      }),
    });
    return db;
  } catch (error) {
    console.error("Failed to create database connection:", error);
    throw error;
  }
}

export async function closeConnection() {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

export const connectDatabase = async (env?: string): Promise<DB> =>
  await switchEnv(env, {
    prod: async () =>
      _env.DATABASE_URL_REPLICA_1
        ? withReplicas(await getConnection(_env.DATABASE_URL), [
            await getConnection(_env.DATABASE_URL_REPLICA_1),
          ])
        : await getConnection(_env.DATABASE_URL ?? ""),
    beta: async () => await getConnection(_env.BETA_DATABASE_URL ?? ""),
    local: async () => await getConnection(_env.LOCAL_DATABASE_URL ?? ""),
  });
