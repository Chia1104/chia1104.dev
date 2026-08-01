import type { Keyv } from "keyv";

import { isUrl } from "@chia/utils/is";

import { createPostgresKv } from "./adapters/postgres.ts";
import { createRedisKv } from "./adapters/redis.ts";
import { createValkeyKv } from "./adapters/valkey.ts";
import { env } from "./env.ts";

let kv: Keyv | null = null;

/** Backends a resolved cache configuration can land on. `upstash` is REST-only. */
export type CacheProvider = "redis" | "valkey" | "postgres" | "upstash";

/**
 * Resolves the configured provider, following `auto` through to the URI's protocol.
 *
 * Split out from {@link createKeyv} so callers that need a *different* client for the same backend
 * — pub/sub needs its own connections, since a subscriber cannot run ordinary commands — can ask
 * what the backend is without a second copy of the protocol sniffing.
 */
export const resolveCacheProvider = (): CacheProvider => {
  if (env.CACHE_PROVIDER !== "auto") return env.CACHE_PROVIDER;

  const protocol =
    env.CACHE_URI &&
    isUrl(env.CACHE_URI, {
      allowedProtocols: ["redis", "valkey", "rediss", "valkeys", "postgres"],
    })
      ? new URL(env.CACHE_URI).protocol.replace(":", "")
      : null;

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

export const createKeyv = () => {
  if (kv) {
    return kv;
  }

  switch (resolveCacheProvider()) {
    case "redis": {
      kv = createRedisKv();
      break;
    }
    case "valkey": {
      kv = createValkeyKv();
      break;
    }
    case "postgres": {
      kv = createPostgresKv();
      break;
    }
    default:
      throw new Error(`Unsupported provider: ${env.CACHE_PROVIDER}`);
  }
  return kv;
};
