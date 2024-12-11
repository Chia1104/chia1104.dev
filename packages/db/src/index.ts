import * as _dotenv from "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { switchEnv } from "@chia/utils/config";

import * as schema from "./schema";

export const db = drizzle<typeof schema>(process.env.DATABASE_URL ?? "", {
  schema,
});

export const localDb = drizzle<typeof schema>(
  process.env.LOCAL_DATABASE_URL ?? "",
  {
    schema,
  }
);

export const betaDb = drizzle<typeof schema>(
  process.env.BETA_DATABASE_URL ?? "",
  {
    schema,
  }
);

export type DB = NodePgDatabase<typeof schema>;

export { schema };
export * from "drizzle-orm";
export { pgTable as tableCreator } from "./schema/table";

export * from "./schema/enums";

export const getDB = (env?: string): DB =>
  switchEnv(env, {
    prod: () => db,
    beta: () => betaDb,
    local: () => localDb,
  });
