import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { relations } from "./schemas/relations";
import { storableCodecs } from "./storable";

export const mockDB = drizzle({
  client: new Pool({
    connectionString: "postgres://localhost:5432/postgres",
    connectionTimeoutMillis: 10_000,
  }),
  relations,
  codecs: storableCodecs,
});
