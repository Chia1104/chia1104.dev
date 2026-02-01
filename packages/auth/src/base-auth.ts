import { passkey } from "@better-auth/passkey";
import type { BetterAuthOptions } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { apiKey } from "better-auth/plugins";
import { admin } from "better-auth/plugins";
import { organization } from "better-auth/plugins";
import { Resend } from "resend";

import { Role } from "@chia/db/types";
import AuthEmailTemplate from "@chia/ui/features/AuthEmailTemplate";
import { AUTH_EMAIL } from "@chia/utils/config";

import { env } from "./env";
import { useSecureCookies, getCookieDomain, X_CH_API_KEY } from "./utils";

export const name = "auth-core";

const resend = new Resend(env.RESEND_API_KEY);

const getOrigin = (url?: string) => {
  if (!url) {
    return undefined;
  }
  return new URL(url).origin;
};

export const baseAuthConfig = {
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

  /**
   * base path for all auth routes
   */
  basePath: env.AUTH_BASE_PATH,

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
          react: AuthEmailTemplate({
            url,
          }),
        });
      },
    }),
    passkey(),
    apiKey({
      apiKeyHeaders: X_CH_API_KEY,
      defaultPrefix: "ch_",
      rateLimit: {
        enabled: false,
      },
    }),
    admin({
      adminRoles: ["admin"],
      adminUserIds: [
        env.ADMIN_ID,
        env.BETA_ADMIN_ID,
        env.LOCAL_ADMIN_ID,
      ].filter(Boolean) as string[],
    }),
    organization(),
  ],
} satisfies BetterAuthOptions;
