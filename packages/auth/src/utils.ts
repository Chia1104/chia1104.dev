import type { env as internalEnv } from "./env";

export const useSecureCookies = process.env.NODE_ENV === "production";
export const DEFAULT_COOKIE_DOMAIN = ".chia1104.dev";
export const X_CH_API_KEY = "x-ch-api-key";

export const getCookieDomain = (options?: {
  env?: Partial<typeof internalEnv>;
}): string => {
  options ??= {};
  const { env } = options;
  const AUTH_URL = env?.AUTH_URL?.replace(/\/api\/v1\/auth$/, "");
  if (
    AUTH_URL?.includes("localhost") ??
    AUTH_URL?.includes("127.0.0.1") ??
    process.env.NODE_ENV === "development"
  ) {
    return AUTH_URL?.includes("127.0.0.1") ? "127.0.0.1" : "localhost";
  }
  return (
    env?.AUTH_COOKIE_DOMAIN ??
    AUTH_URL?.replace(/(^\w+:|^)\/\//, "") ??
    DEFAULT_COOKIE_DOMAIN
  );
};
