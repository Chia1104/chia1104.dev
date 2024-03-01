import type { NextAuthConfig } from "next-auth";
import type { env as internalEnv } from "./env";
import { NextRequest } from "next/server";

export const useSecureCookies = process.env.NODE_ENV === "production";
export const cookiePrefix = useSecureCookies ? "__Secure-" : "";

export const getCookieDomain = (options?: {
  req?: NextRequest | Request;
  env?: Partial<typeof internalEnv>;
}) => {
  options ??= {};
  const { req, env } = options;
  const AUTH_URL = env?.AUTH_URL?.replace(/\/api\/auth$/, "");
  if (
    AUTH_URL?.includes("localhost") ||
    process.env.NODE_ENV === "development"
  ) {
    return "localhost";
  }
  if (req instanceof NextRequest) {
    return (
      env?.AUTH_COOKIE_DOMAIN ??
      AUTH_URL?.replace(/(^\w+:|^)\/\//, "") ??
      req?.nextUrl?.hostname ??
      ".chia1104.dev"
    );
  }
  return (
    env?.AUTH_COOKIE_DOMAIN ??
    AUTH_URL?.replace(/(^\w+:|^)\/\//, "") ??
    ".chia1104.dev"
  );
};

export const getBaseConfig = (options?: {
  req?: NextRequest | Request;
  env?: Partial<typeof internalEnv>;
}) => {
  options ??= {};
  const { req, env } = options;
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
          domain: getCookieDomain({ req, env }),
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
          // @ts-ignore
          role: user.role,
          id: user.id,
        },
      }),
    },
  } satisfies Omit<NextAuthConfig, "adapter" | "providers">;
};
