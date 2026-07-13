import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/env";

interface FeedImageTokenPayload {
  locale: string;
  slug: string;
  type: string;
}

const TOKEN_PATTERN = /^[\da-f]{64}$/;

const signPayload = ({ locale, slug, type }: FeedImageTokenPayload) =>
  createHmac("sha256", env.SHA_256_HASH)
    .update(JSON.stringify([locale, type, slug]))
    .digest("hex");

export const createFeedImageToken = (payload: FeedImageTokenPayload) =>
  signPayload(payload);

export function verifyFeedImageToken(
  payload: FeedImageTokenPayload,
  token: string
) {
  if (!TOKEN_PATTERN.test(token)) {
    return false;
  }

  const expectedToken = Buffer.from(signPayload(payload), "hex");
  const providedToken = Buffer.from(token, "hex");

  return timingSafeEqual(expectedToken, providedToken);
}
