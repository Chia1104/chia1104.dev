import { isUrl } from "@chia/utils/is";

import { env } from "./env.ts";

/**
 * Which cache backend the environment resolves to, decided without touching a client.
 *
 * Deliberately its own module rather than living next to {@link createKeyv}: `clients.ts` statically
 * imports every adapter, so anything importing it drags `@keyv/valkey` — and therefore `iovalkey`,
 * which uses a dynamic `require` that bundlers refuse — into the graph. Callers that only need to
 * *ask* what the backend is must not pay for that.
 */

/** Backends a resolved cache configuration can land on. `upstash` is REST-only. */
export type CacheProvider = "redis" | "valkey" | "postgres" | "upstash";

const ALLOWED_PROTOCOLS = ["redis", "rediss", "valkey", "valkeys", "postgres"];

export const resolveCacheProvider = (): CacheProvider => {
  if (env.CACHE_PROVIDER !== "auto") return env.CACHE_PROVIDER;

  // Neither message may echo `CACHE_URI` back: it carries credentials, and the protocol alone is
  // enough to act on.
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
