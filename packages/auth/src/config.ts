import type { DefaultSession } from "@auth/core/types";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { Session as NextAuthSession } from "next-auth";
import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import type { NextRequest } from "next/server";
import crypto from "node:crypto";

import { env } from "@chia/auth-core/env";
import { getBaseConfig } from "@chia/auth-core/utils";
import { db, localDb, betaDb, schema } from "@chia/db";
import { getDb } from "@chia/utils";
import { AUTH_EMAIL } from "@chia/utils";

import { sendVerificationRequest } from "./authSendRequest";

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

declare module "next-auth" {
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

const adapter = DrizzleAdapter(
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
);

export const getConfig = (req?: NextRequest) => {
  return {
    ...getBaseConfig({
      req,
      env: {
        AUTH_URL,
        AUTH_COOKIE_DOMAIN: env.AUTH_COOKIE_DOMAIN,
      },
    }),
    pages: {
      signIn: "/auth/signin",
      verifyRequest: "/auth/verify-request",
    },
    adapter,
    providers: [
      Google({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
      GitHub({
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
      Resend({
        from: AUTH_EMAIL,
        apiKey: env.RESEND_API_KEY,
        generateVerificationToken() {
          return crypto.randomBytes(32).toString("hex");
        },
        sendVerificationRequest,
      }),
    ],
    skipCSRFCheck: undefined,
  } satisfies NextAuthConfig;
};

export const validateToken = async (
  token: string
): Promise<NextAuthSession | null> => {
  const sessionToken = token.slice("Bearer ".length);
  const session = await adapter.getSessionAndUser?.(sessionToken);
  return session
    ? {
        user: {
          ...session.user,
        },
        expires: session.session.expires.toISOString(),
      }
    : null;
};

export const invalidateSessionToken = async (token: string) => {
  await adapter.deleteSession?.(token);
};
