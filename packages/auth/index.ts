import NextAuth, { type NextAuthConfig } from "next-auth";
import { db, tableCreator, localDb, betaDb } from "@chia/db";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { env } from "./env";
import { getDb } from "@chia/utils";
import type { NextRequest } from "next/server";
import { getBaseConfig } from "./utils";

const AUTH_URL = env.AUTH_URL?.replace(/\/api\/auth$/, "");

export const getConfig = (req?: NextRequest) => {
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
} = NextAuth(getConfig());
export type { Session } from "@auth/core/types";
