import crypto from "node:crypto";

/**
 * Shared edge-gateway plumbing used by every service and the local dev proxy:
 * trusted identity headers, base64url payload codecs, hop-by-hop header
 * sanitization and the internal-token compare. Keep this module free of
 * package dependencies.
 */

export const X_CH_INTERNAL_TOKEN = "x-ch-internal-token";

/**
 * Identity headers injected by the edge gateway (Caddy `forward_auth` → the
 * auth service's `/internal/gate` route) after it has authenticated a request.
 * Downstream services may trust them ONLY when they are not publicly
 * reachable — the gateway strips any client-supplied values before proxying.
 */
export const X_CH_AUTH_SESSION = "x-ch-auth-session";
export const X_CH_AUTH_API_KEY = "x-ch-auth-api-key";

/**
 * Every identity header a gateway may inject — strip these from inbound
 * public traffic so they can never be spoofed.
 */
export const TRUSTED_HEADERS = [X_CH_AUTH_SESSION, X_CH_AUTH_API_KEY] as const;

/**
 * Header values must be ASCII, and the payloads (session, api-key metadata)
 * are JSON — base64url keeps them header-safe. Note that Date fields survive
 * as ISO strings after a round-trip.
 */
export const encodeTrustedHeader = (payload: unknown): string =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

export const decodeTrustedHeader = <TPayload>(
  value: string | null | undefined
): TPayload | null => {
  if (!value) return null;
  try {
    return JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    ) as TPayload;
  } catch {
    return null;
  }
};

/**
 * Headers that must not be forwarded between services.
 * `accept-encoding` is stripped because fetch transparently decompresses
 * responses, which would otherwise conflict with a forwarded encoding header.
 */
export const HOP_BY_HOP_HEADERS = [
  "host",
  "connection",
  "content-length",
  "accept-encoding",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
];

export const sanitizeHeaders = (headers?: HeadersInit) => {
  const result = new Headers(headers);
  for (const header of HOP_BY_HOP_HEADERS) {
    result.delete(header);
  }
  return result;
};

/**
 * Timing-safe compare for the shared internal token guarding
 * server-to-server routes. Hashing first equalizes the input lengths.
 */
export const isValidInternalToken = (token: string, expected: string) => {
  const tokenHash = crypto.createHash("sha256").update(token).digest();
  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(tokenHash, expectedHash);
};
