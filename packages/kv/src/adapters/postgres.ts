import { createKeyv } from "@keyv/postgres";

import { env } from "../env.ts";

export const createPostgresKv = (
  uri = env.CACHE_URI ??
    env.POSTGRES_URI ??
    "postgres://localhost:5432/postgres"
) => createKeyv({ uri });
