import { randomToken, sha256 } from "./crypto";
import { useSecureCookies } from "./utils";

/** A session ends this long after sign-in; there is no sliding renewal. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** `__Secure-` makes the browser refuse the cookie unless it is set over TLS with `Secure`. */
export const SESSION_COOKIE = useSecureCookies
  ? "__Secure-chia1104.dev.session"
  : "chia1104.dev.session";

export const createSessionToken = () => randomToken();

export const hashSessionToken = (token: string) => sha256(token);

/** The raw value of cookie `name` in a `Cookie` header, or `null`. */
export const readCookie = (headers: Headers, name: string): string | null => {
  const header = headers.get("Cookie");
  if (!header) return null;
  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() === name) {
      const value = pair.slice(separator + 1).trim();
      return value.length > 0 ? value : null;
    }
  }
  return null;
};

export const readSessionToken = (headers: Headers) =>
  readCookie(headers, SESSION_COOKIE);
