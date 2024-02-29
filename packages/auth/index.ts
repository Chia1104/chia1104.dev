import NextAuth, { type NextAuthConfig } from "next-auth";
import { db, tableCreator, localDb, betaDb } from "@chia/db";
import type { DefaultSession } from "@auth/core/types";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { env } from "./env";
import { getDb } from "@chia/utils";
import type { NextRequest } from "next/server";

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
const useSecureCookies = process.env.NODE_ENV === "production";
const cookiePrefix = useSecureCookies ? "__Secure-" : "";

export const getCookieDomain = (req?: NextRequest) => {
  if (
    AUTH_URL?.includes("localhost") ||
    process.env.NODE_ENV === "development"
  ) {
    return "localhost";
  }
  return (
    env.AUTH_COOKIE_DOMAIN ??
    AUTH_URL?.replace(/(^\w+:|^)\/\//, "") ??
    req?.nextUrl.hostname ??
    ".chia1104.dev"
  );
};

export const getBaseConfig = (req?: NextRequest) => {
  return {
    trustHost: true,
    useSecureCookies,
    cookies: {
      sessionToken: {
        name: `${cookiePrefix}authjs.session-token`,
        options: {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: useSecureCookies,
          domain: getCookieDomain(req),
        },
      },
    },
    pages: {
      signIn: "/login",
    },
    callbacks: {
      session: ({ session, user }) => ({
        ...session,
        user: {
          ...session.user,
          role: user.role,
          id: user.id,
        },
      }),
    },
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
        allowDangerousEmailAccountLinking: true,
      }),
    ],
  } satisfies NextAuthConfig;
};

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth(getBaseConfig());
export type { Session } from "@auth/core/types";
