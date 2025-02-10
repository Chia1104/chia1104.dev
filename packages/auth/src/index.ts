import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";

import { createRedis } from "@chia/cache";
import { connectDatabase } from "@chia/db/client";
import * as schemas from "@chia/db/schema";
import { Role } from "@chia/db/types";
import EmailTemplate from "@chia/ui/features/AuthEmailTemplate";
import { CONTACT_EMAIL } from "@chia/utils";

import { env } from "./env";
import { useSecureCookies, getCookieDomain } from "./utils";

export const name = "auth-core";

const resend = new Resend(env.RESEND_API_KEY);
const database = await connectDatabase();
const redis = createRedis();

const getOrigin = (url?: string) => {
  if (!url) {
    return undefined;
  }
  return new URL(url).origin;
};

export const auth = betterAuth({
  appName: "Chia1104.dev",

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

  secondaryStorage: {
    get: async (key) => {
      const value = await redis.get(key);
      return value ? value : null;
    },
    set: async (key, value, ttl) => {
      if (ttl) await redis.set(key, value, "EX", ttl);
      else await redis.set(key, value);
    },
    delete: async (key) => {
      await redis.del(key);
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
          from: CONTACT_EMAIL,
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
  ],
});
