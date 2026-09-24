import type { Keyv } from "keyv";

import { createPostgresKv } from "./adapters/postgres.ts";
import { createRedisKv } from "./adapters/redis.ts";
import { createValkeyKv } from "./adapters/valkey.ts";
import { env } from "./env.ts";
import { CacheProvider, resolveCacheProvider } from "./provider.ts";

let kv: Keyv | null = null;

export const createKeyv = () => {
  if (kv) {
    return kv;
  }

  switch (resolveCacheProvider()) {
    case CacheProvider.Redis: {
      kv = createRedisKv();
      break;
    }
    case CacheProvider.Valkey: {
      kv = createValkeyKv();
      break;
    }
    case CacheProvider.Postgres: {
      kv = createPostgresKv();
      break;
    }
    default:
      throw new Error(`Unsupported provider: ${env.CACHE_PROVIDER}`);
  }
  return kv;
};
