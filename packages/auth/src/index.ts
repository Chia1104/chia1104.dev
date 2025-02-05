import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";

import { connectDatabase } from "@chia/db/client";
import * as schemas from "@chia/db/schema";
import { Role } from "@chia/db/types";
import { WWW_BASE_URL, DASH_BASE_URL, SERVICE_BASE_URL } from "@chia/utils";
import { getServiceEndPoint } from "@chia/utils";

import { env } from "./env";
import { useSecureCookies, getCookieDomain } from "./utils";

export const name = "auth-core";

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
  database: drizzleAdapter(await connectDatabase(), {
    provider: "pg",
    schema: {
      ...schemas,
      user: schemas.users,
      account: schemas.betterAccount,
      session: schemas.betterSession,
    },
  }),

  user: {
    additionalFields: {
      role: {
        type: [Role.User, Role.Admin],
        required: true,
        defaultValue: Role.User,
        input: true,
      },
    },
  },

  /**
   * base path for all auth routes
   */
  basePath: process.env.APP_CODE !== "service" ? "/auth" : "/api/v1/auth",

  baseURL:
    process.env.APP_CODE !== "service" ? getServiceEndPoint() : undefined,

  /**
   * advanced configuration
   */
  advanced: {
    cookiePrefix: "chia1104.dev",
    crossSubDomainCookies: {
      enabled: true,
      domain: getCookieDomain({ env }),
    },
    defaultCookieAttributes: {
      secure: useSecureCookies,
    },
  },

  trustedOrigins: [WWW_BASE_URL, DASH_BASE_URL, SERVICE_BASE_URL],

  plugins: [
    magicLink({
      sendMagicLink: async ({ email, token, url }, request) => {
        // send email to user
      },
    }),
  ],
});
