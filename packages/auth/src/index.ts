import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { connectDatabase } from "@chia/db/client";
import * as schemas from "@chia/db/schema";
import { kv } from "@chia/kv";

import { baseAuthConfig } from "./base-auth";

export const name = "auth-core";

const database = await connectDatabase();

export const auth = betterAuth(
  Object.assign(baseAuthConfig, {
    ...baseAuthConfig,
    /**
     * database adapter
     */
    database: drizzleAdapter(database, {
      provider: "pg",
      schema: schemas,
    }),
    secondaryStorage: {
      get: async (key) => {
        const value = await kv.get<string>(key);
        return value ? value : null;
      },
      set: async (key, value, ttl) => {
        if (ttl) {
          await kv.set(key, value, ttl * 1000);
        } else {
          await kv.set(key, value);
        }
      },
      delete: async (key) => {
        await kv.delete(key);
      },
    },
  } satisfies BetterAuthOptions)
);
