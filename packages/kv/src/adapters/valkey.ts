import { createKeyv } from "@keyv/valkey";

import { env } from "../env.ts";

export const createValkeyKv = (
  uri = env.CACHE_URI ?? env.VALKEY_URI ?? "valkey://localhost:6379"
) => createKeyv(uri);
