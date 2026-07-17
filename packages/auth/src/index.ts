import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import type { DB } from "@chia/db";
import * as schemas from "@chia/db/schema";
import type { Keyv } from "@chia/kv";

import { baseAuthConfig } from "./base-auth";

export const name = "auth-core";

export const createAuth = (
  db: DB,
  kv: Keyv,
  options?: {
    /**
     * Override the base path from AUTH_BASE_PATH — used by the standalone
     * auth service, whose mount is fixed at `/auth`. Kept as an explicit
     * field (not a config spread) so better-auth's type inference from
     * `baseAuthConfig` stays intact.
     */
    basePath?: string;
  }
) =>
  betterAuth({
    ...baseAuthConfig,
    basePath: options?.basePath ?? baseAuthConfig.basePath,
    /**
     * database adapter
     */
    database: drizzleAdapter(db, {
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
  });

export type Auth = ReturnType<typeof createAuth>;
