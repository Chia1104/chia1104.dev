import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import type { DB } from "@chia/db/client";
import * as schemas from "@chia/db/schema";
import type { Keyv } from "@chia/kv/types";
import { IS_PRODUCTION } from "@chia/utils/config";

import { baseAuthConfig } from "./base-auth";

export const name = "auth-core";

const buildAuth = (db: DB, kv: Keyv) =>
  betterAuth({
    ...baseAuthConfig,
    account: {
      skipStateCookieCheck: !IS_PRODUCTION,
    },
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
      getAndDelete: async (key) => {
        const value = await kv.get<string>(key);
        if (value) {
          await kv.delete(key);
        }
        return value ? value : null;
      },
      increment: async (key, ttl) => {
        const value = await kv.get<number>(key);
        if (value) {
          await kv.set(key, value + 1, ttl * 1000);
        } else {
          await kv.set(key, 1, ttl * 1000);
        }
        return value ? value + 1 : 1;
      },
    },
  });

/**
 * Memoized: `betterAuth()` eagerly builds the full auth context and endpoint router
 * (~0.7 MB allocated per call), and `db`/`kv` are process singletons, so one instance
 * serves every request.
 */
let auth: ReturnType<typeof buildAuth> | undefined;

export const createAuth = (db: DB, kv: Keyv) => (auth ??= buildAuth(db, kv));

export type Auth = ReturnType<typeof buildAuth>;
