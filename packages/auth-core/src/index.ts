import { Auth as InternalAuth, type AuthConfig } from "@auth/core";
import { db, tableCreator, localDb, betaDb } from "@chia/db";
import Google from "@auth/core/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { env } from "./env";
import { getDb } from "@chia/utils";
import { getBaseConfig } from "./utils";
import type { DefaultSession, Session } from "@auth/core/types";

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
      tableCreator
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
