import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { apiKey } from "better-auth/plugins";
import { admin } from "better-auth/plugins";
import { organization } from "better-auth/plugins";
import { passkey } from "better-auth/plugins/passkey";
import { Resend } from "resend";

import { connectDatabase } from "@chia/db/client";
import * as schemas from "@chia/db/schema";
import { Role } from "@chia/db/types";
import { kv } from "@chia/kv";
import EmailTemplate from "@chia/ui/features/AuthEmailTemplate";
import { AUTH_EMAIL } from "@chia/utils";

import { env } from "./env";
import { useSecureCookies, getCookieDomain, X_CH_API_KEY } from "./utils";

export const name = "auth-core";

const resend = new Resend(env.RESEND_API_KEY);
const database = await connectDatabase();

const getOrigin = (url?: string) => {
  if (!url) {
    return undefined;
  }
  return new URL(url).origin;
};

export const auth = betterAuth({
  appName: "Chia1104.dev",

  /**
   * session configuration
   */
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days in seconds
    updateAge: 60 * 60 * 24, // 1 day in seconds
  },

  socialProviders: {
    github:
      env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          }
        : undefined,
    google:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          }
        : undefined,
  },

  /**
   * database adapter
   */
  database: drizzleAdapter(database, {
    provider: "pg",
    schema: {
      ...schemas,
      user: schemas.users,
    },
  }),

  /**
   * comment the following if you want to run the migration script
   * ```sh
   * pnpm auth-schema:generate
   * ```
   */
  user: {
    additionalFields: {
      role: {
        type: [Role.User, Role.Admin, Role.Root],
        required: true,
        defaultValue: Role.User,
        input: true,
      },
    },
  },

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

  /**
   * base path for all auth routes
   */
  basePath: "/api/v1/auth",

  baseURL: getOrigin(env.AUTH_URL),
  secret: env.AUTH_SECRET,

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

  trustedOrigins: env.CORS_ALLOWED_ORIGIN
    ? env.CORS_ALLOWED_ORIGIN.split(",")
    : [],

  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await resend.emails.send({
          from: AUTH_EMAIL,
          to: email,
          subject: "Sign in to Chia1104.dev",
          text: "Please click the link below to sign in",
          react: EmailTemplate({
            url,
            host: new URL(url).host,
          }),
        });
      },
    }),
    passkey(),
    apiKey({
      apiKeyHeaders: X_CH_API_KEY,
      defaultPrefix: "ch_",
    }),
    admin({
      adminRoles: ["admin", "root"],
      adminUserIds: [
        env.ADMIN_ID,
        env.BETA_ADMIN_ID,
        env.LOCAL_ADMIN_ID,
      ].filter(Boolean) as string[],
    }),
    organization(),
  ],
});
