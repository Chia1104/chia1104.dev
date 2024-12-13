import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { switchEnv } from "@chia/utils/config";

import type { DB } from ".";
import * as schema from "./schema";

let pool: Pool | null = null;
let db: DB | null = null;

export async function getConnection(url: string) {
  // Check if pool exists and token is still valid
  if (db) {
    return db;
  }

  // Token is expired or pool is null, recreate pool and db
  try {
    await closeConnection();

    pool = new Pool({
      connectionString: url,
    });
    db = drizzle(pool, { schema });
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
    prod: async () => await getConnection(process.env.DATABASE_URL ?? ""),
    beta: async () => await getConnection(process.env.BETA_DATABASE_URL ?? ""),
    local: async () =>
      await getConnection(process.env.LOCAL_DATABASE_URL ?? ""),
  });
