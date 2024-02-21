import NextAuth from "next-auth";
import { db, tableCreator, localDb, betaDb } from "@chia/db";
import type { DefaultSession } from "@auth/core/types";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { env } from "./env";
import { getDb } from "@chia/utils";

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

/**
 * @todo nest-auth issue
 */
const AUTH_URL = env.AUTH_URL;
const useSecureCookies = AUTH_URL?.startsWith("https://");
const cookiePrefix = useSecureCookies ? "__Secure-" : "";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  useSecureCookies,
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        domain: AUTH_URL?.includes("localhost")
          ? "localhost"
          : env.AUTH_COOKIE_DOMAIN,
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
});
export type { Session } from "@auth/core/types";
