import { Auth as InternalAuth } from "@auth/core";
import type { AuthConfig } from "@auth/core";
import Github from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { createRedis } from "@chia/cache";
import { connectDatabase } from "@chia/db/client";
import * as schemas from "@chia/db/schema";

import { adapter } from "./adapter";
import { env } from "./env";
import {
  getBaseConfig,
  SESSION_MAX_AGE,
  SESSION_UPDATE_AGE,
  useSecureCookies,
  getCookieDomain,
} from "./utils";

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

export const getConfig = async (
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
    adapter: adapter({
      db: await connectDatabase(),
      redis: createRedis(),
    }),
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
    session: {
      maxAge: SESSION_MAX_AGE,
      updateAge: SESSION_UPDATE_AGE,
    },
    ...config,
  } satisfies AuthConfig;
};

export const Auth = (
  request: Request,
  config?: Partial<Omit<AuthConfig, "raw">>
) => (async () => InternalAuth(request, await getConfig(request, config)))();
export type { Session } from "@auth/core/types";

export const auth = betterAuth({
  socialProviders: {
    github:
      env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          }
        : undefined,
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },

  /**
   * database adapter
   */
  database: drizzleAdapter(await connectDatabase("development"), {
    provider: "pg",
    schema: {
      ...schemas,
      user: schemas.users,
    },
  }),

  /**
   * session and account field names
   */
  session: {
    fields: {
      expiresAt: "expires", // e.g., "expires_at" or your existing field name
      token: "sessionToken", // e.g., "session_token" or your existing field name
    },
  },
  accounts: {
    fields: {
      accountId: "providerAccountId",
      refreshToken: "refresh_token",
      accessToken: "access_token",
      accessTokenExpiresAt: "access_token_expires",
      idToken: "id_token",
    },
  },

  /**
   * base path for all auth routes
   */
  basePath: "/api/v1/auth",

  /**
   * advanced configuration
   */
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
      domain: getCookieDomain({ env }),
    },
    defaultCookieAttributes: {
      sameSite: "none",
      secure: useSecureCookies,
    },
  },
});
