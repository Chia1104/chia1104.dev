import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schemas";

export const mockDB = drizzle(
  new Pool({
    connectionString: "postgres://localhost:5432/postgres",
    connectionTimeoutMillis: 10_000,
  }),
  {
    schema,
  }
);
