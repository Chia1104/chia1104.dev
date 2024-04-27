import { Auth as InternalAuth, type AuthConfig } from "@auth/core";
import { db, localDb, betaDb, schema } from "@chia/db";
import Google from "@auth/core/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { env } from "./env";
import { getDb } from "@chia/utils";
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
    ],
    ...config,
  } satisfies AuthConfig;
};

export const Auth = (
  request: Request,
  config?: Partial<Omit<AuthConfig, "raw">>
) => InternalAuth(request, getConfig(request, config));
export type { Session } from "@auth/core/types";
