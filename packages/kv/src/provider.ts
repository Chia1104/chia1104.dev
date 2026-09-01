import { isUrl } from "@chia/utils/is";

import { env } from "./env.ts";

/** `upstash` is REST-only. */
export type CacheProvider = "redis" | "valkey" | "postgres" | "upstash";

const ALLOWED_PROTOCOLS = ["redis", "rediss", "valkey", "valkeys", "postgres"];

/**
 * Resolves the cache backend without importing a client. Lives here because
 * `clients.ts` statically imports every adapter, including `@keyv/valkey` /
 * `iovalkey`, which bundlers refuse.
 */
export const resolveCacheProvider = (): CacheProvider => {
  if (env.CACHE_PROVIDER !== "auto") return env.CACHE_PROVIDER;

  // Neither message may echo `CACHE_URI`: it carries credentials; the protocol is enough to act on.
  if (!env.CACHE_URI) {
    throw new Error(
      'CACHE_PROVIDER is "auto" but CACHE_URI is not set. Set CACHE_URI, or pin CACHE_PROVIDER to a backend.'
    );
  }

  if (!isUrl(env.CACHE_URI, { allowedProtocols: ALLOWED_PROTOCOLS })) {
    throw new Error(
      `CACHE_URI is not a valid cache URI. Expected one of: ${ALLOWED_PROTOCOLS.map((protocol) => `${protocol}://`).join(", ")}.`
    );
  }

  const protocol = new URL(env.CACHE_URI).protocol.replace(":", "");

  switch (protocol) {
    case "rediss":
    case "redis":
      return "redis";
    case "valkeys":
    case "valkey":
      return "valkey";
    case "postgres":
      return "postgres";
    default:
      throw new Error(`Unsupported protocol: ${protocol}`);
  }
};
