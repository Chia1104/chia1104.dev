import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, customSession } from "better-auth/plugins";

import type { DB } from "@chia/db/client";
import { transferAgentOwnership } from "@chia/db/repos/agent";
import * as schemas from "@chia/db/schema";
import type { Keyv } from "@chia/kv/types";
import { IS_PRODUCTION, getAdminId } from "@chia/utils/config";

import type { AccessOptions } from "./access";
import { resolveAccess } from "./access";
import { baseAuthConfig } from "./base-auth";

export const name = "auth-core";

export interface CreateAuthOptions {
  access: AccessOptions;
}

const buildAuth = (db: DB, kv: Keyv, options: CreateAuthOptions) => {
  /**
   * Registered here rather than in `baseAuthConfig` because the link hook needs the
   * database. On sign-in, ownership moves to the account before better-auth deletes the
   * guest row. `customSession` infers the user shape from these options, so they are
   * assembled first.
   */
  const withGuests = {
    ...baseAuthConfig,
    plugins: [
      ...baseAuthConfig.plugins,
      anonymous({
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          await transferAgentOwnership(db, {
            fromUserId: anonymousUser.user.id,
            toUserId: newUser.user.id,
          });
        },
      }),
    ],
  } satisfies BetterAuthOptions;

  return betterAuth({
    ...withGuests,
    plugins: [
      ...withGuests.plugins,
      // Also runs for the service's own `auth.api.getSession`, so the read stays one small query.
      customSession(async ({ user, session }) => {
        const access = await resolveAccess(
          db,
          user,
          getAdminId(),
          options.access
        );
        return { user, session, access };
      }, withGuests),
    ],
    account: {
      skipStateCookieCheck: !IS_PRODUCTION,
    },
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
};

/**
 * Memoized: `betterAuth()` eagerly builds the full auth context (~0.7 MB per
 * call), and `db`/`kv` are process singletons.
 */
let auth: ReturnType<typeof buildAuth> | undefined;

export const createAuth = (db: DB, kv: Keyv, options: CreateAuthOptions) =>
  (auth ??= buildAuth(db, kv, options));

export type Auth = ReturnType<typeof buildAuth>;
