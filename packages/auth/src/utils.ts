import type { createAuthClient } from "better-auth/client";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { magicLinkClient } from "better-auth/client/plugins";
import { passkeyClient } from "better-auth/client/plugins";
import { apiKeyClient } from "better-auth/client/plugins";
import { organizationClient } from "better-auth/client/plugins";
import { adminClient } from "better-auth/client/plugins";

import { Role } from "@chia/db/types";
import { getServiceEndPoint } from "@chia/utils";

import type { env as internalEnv } from "./env";

export const useSecureCookies = process.env.NODE_ENV === "production";
export const cookiePrefix = useSecureCookies ? "__Secure-" : "";
export const DEFAULT_COOKIE_DOMAIN = ".chia1104.dev";
export const X_CH_API_KEY = "x-ch-api-key";

/**
 * @deprecated
 */
export const SESSION_TOKEN = useSecureCookies
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";

export const SESSION_MAX_AGE = 2592000; // 30 days
export const SESSION_UPDATE_AGE = 86400; // 1 day

export const getCookieDomain = (options?: {
  env?: Partial<typeof internalEnv>;
}): string => {
  options ??= {};
  const { env } = options;
  const AUTH_URL = env?.AUTH_URL?.replace(/\/api\/v1\/auth$/, "");
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

export const baseAuthClient = (
  config?: Parameters<typeof createAuthClient>[0]
) => {
  return Object.assign(config ?? {}, {
    baseURL: `${getServiceEndPoint()}/auth`,
    plugins: [
      inferAdditionalFields({
        user: {
          role: {
            type: [Role.User, Role.Admin, Role.Root],
            required: true,
            defaultValue: Role.User,
            input: true,
          },
        },
      }),
      magicLinkClient(),
      passkeyClient(),
      apiKeyClient(),
      organizationClient(),
      adminClient(),
    ],
  });
};
