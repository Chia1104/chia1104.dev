import type { Keyv } from "keyv";

import { createPostgresKv } from "./adapters/postgres.ts";
import { createRedisKv } from "./adapters/redis.ts";
import { createValkeyKv } from "./adapters/valkey.ts";
import { env } from "./env.ts";
import { resolveCacheProvider } from "./provider.ts";

export { resolveCacheProvider, type CacheProvider } from "./provider.ts";

let kv: Keyv | null = null;

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
