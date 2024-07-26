import { Auth as InternalAuth } from "@auth/core";
import type { AuthConfig } from "@auth/core";
import Github from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";

import { db, localDb, betaDb, schema } from "@chia/db";
import { getDb } from "@chia/utils";

import { env } from "./env";
import { getBaseConfig } from "./utils";

declare module "@auth/core/types" {
  interface Session extends DefaultSession {
    user: {
      role: "admin" | "user";
    } & DefaultSession["user"];
  }

  interface User {
    role: "admin" | "user";
  }
}

const AUTH_URL = env.AUTH_URL?.replace(/\/api\/auth$/, "");

export const name = "auth-core";

export const getConfig = (
  req?: Request,
  config?: Partial<Omit<AuthConfig, "raw">>
) => {
  return {
    ...getBaseConfig({
      req,
      env: {
        AUTH_URL,
        AUTH_COOKIE_DOMAIN: env.AUTH_COOKIE_DOMAIN,
        AUTH_SECRET: env.AUTH_SECRET,
      },
    }),
    adapter: DrizzleAdapter(
      getDb(undefined, {
        db,
        betaDb,
        localDb,
      }),
      {
        usersTable: schema.users,
        accountsTable: schema.accounts,
        sessionsTable: schema.sessions,
        verificationTokensTable: schema.verificationTokens,
      }
    ),
    providers: [
      Google({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      }),
      Github({
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      }),
    ],
    ...config,
  } satisfies AuthConfig;
};

export const Auth = (
  request: Request,
  config?: Partial<Omit<AuthConfig, "raw">>
) => InternalAuth(request, getConfig(request, config));
export type { Session } from "@auth/core/types";
