import NextAuth from "next-auth";
import { db, tableCreator } from "@chia/db";
import type { DefaultSession } from "@auth/core/types";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
// @ts-ignore
import { env } from "./env.mjs";

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

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  useSecureCookies: process.env.NODE_ENV === "production",
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
  adapter: DrizzleAdapter(db, tableCreator),
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  ],
});
export type { Session } from "@auth/core/types";
