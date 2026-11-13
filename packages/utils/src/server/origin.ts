import { timingSafeEqual } from "node:crypto";

/** Set by Cloudflare on every request it forwards to a Railway origin. */
export const X_ORIGIN_SECRET = "x-origin-secret";

/** Added by Railway's public edge; private networking and health checks never pass the edge. */
const X_RAILWAY_EDGE = "x-railway-edge";

/**
 * Whether a request may reach a Railway origin. One forwarded by Railway's public edge must carry
 * the secret Cloudflare adds, so a client that connects to the edge directly is refused. Without
 * a configured secret every request passes.
 */
export const isOriginRequestAllowed = (
  headers: Headers,
  secret: string | undefined
): boolean => {
  if (!secret || !headers.has(X_RAILWAY_EDGE)) {
    return true;
  }

  const received = Buffer.from(headers.get(X_ORIGIN_SECRET) ?? "");
  const expected = Buffer.from(secret);
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
};
