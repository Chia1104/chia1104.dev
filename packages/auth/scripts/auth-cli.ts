import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { mockDB } from "@chia/db/mock-db";
import * as schemas from "@chia/db/schema";

import { baseAuthConfig } from "../src/base-auth";

export const auth = betterAuth(
  Object.assign(baseAuthConfig, {
    database: drizzleAdapter(mockDB, {
      provider: "pg",
      schema: schemas,
    }),
  } satisfies BetterAuthOptions)
);
