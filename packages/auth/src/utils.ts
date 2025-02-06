import type { env as internalEnv } from "./env";

export const useSecureCookies = process.env.NODE_ENV === "production";
export const cookiePrefix = useSecureCookies ? "__Secure-" : "";
export const DEFAULT_COOKIE_DOMAIN = ".chia1104.dev";

export const SESSION_TOKEN = useSecureCookies
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";

export const SESSION_MAX_AGE = 2592000; // 30 days
export const SESSION_UPDATE_AGE = 86400; // 1 day

export const getCookieDomain = <TRequest extends Request = Request>(options?: {
  /**
   * @deprecated use `env` instead
   */
  req?: TRequest;
  env?: Partial<typeof internalEnv>;
}): string => {
  options ??= {};
  const { env } = options;
  const AUTH_URL = env?.AUTH_URL?.replace(/\/api\/auth$/, "");
  if (
    AUTH_URL?.includes("localhost") ??
    process.env.NODE_ENV === "development"
  ) {
    return "localhost";
  }
  return (
    env?.AUTH_COOKIE_DOMAIN ??
    AUTH_URL?.replace(/(^\w+:|^)\/\//, "") ??
    DEFAULT_COOKIE_DOMAIN
  );
};

export const sessionCookieOptions = (env?: Partial<typeof internalEnv>) =>
  ({
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: useSecureCookies,
    domain: getCookieDomain({ env }),
  }) as const;
