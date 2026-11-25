import { createKeyv } from "@keyv/valkey";

import { env } from "../env.ts";

import { reportKvErrors } from "./report-errors.ts";

export const createValkeyKv = (
  uri = env.CACHE_URI ?? env.VALKEY_URI ?? "valkey://localhost:6379"
) => reportKvErrors(createKeyv(uri));
