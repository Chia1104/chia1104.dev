import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core";

import { reportError } from "@chia/observability/report";
import { switchEnv } from "@chia/utils/config";

import { env as internalEnv } from "./env.ts";
import { relations } from "./schemas/relations.ts";
import { storableCodecs } from "./storable.ts";

/** Query surface for repositories. The driver and its transactions both satisfy it, so `withAgentSessionLock` can reuse them on `tx`. */
export type DB = PgAsyncDatabase<NodePgQueryResultHKT, typeof relations>;

const connections = new Map<string, Promise<DB>>();

export async function getConnection(url: string) {
  const existingConnection = connections.get(url);
  if (existingConnection) {
    return await existingConnection;
  }

  const connection = (async () => {
    const db = drizzle({
      connection: {
        connectionString: url,
        // pg's 10s default closes the pool between most requests at this traffic, and each
        // reconnect costs ~25ms.
        idleTimeoutMillis: 5 * 60_000,
        // Idle clients must not hold the process open, or one-shot scripts like `migrate.ts`
        // wait out the timeout.
        allowExitOnIdle: true,
      },
      relations,
      codecs: storableCodecs,
    });
    // pg-pool emits an idle client's error whether or not anyone listens; unhandled, it ends the process.
    db.$client.on("error", (error) => {
      reportError(error, "Idle database client failed");
    });
    return db;
  })();
  connections.set(url, connection);

  try {
    return await connection;
  } catch (error) {
    connections.delete(url);
    throw error;
  }
}

export const resolveDatabaseUrl = (env?: string): string =>
  switchEnv(env, {
    prod: () => internalEnv.DATABASE_URL,
    beta: () => internalEnv.BETA_DATABASE_URL ?? "",
    local: () => internalEnv.LOCAL_DATABASE_URL ?? "",
  });

export const connectDatabase = async (env?: string): Promise<DB> =>
  await getConnection(resolveDatabaseUrl(env));
