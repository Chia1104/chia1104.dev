import type { Keyv } from "keyv";

import { isUrl } from "@chia/utils/is";

import { createPostgresKv } from "./adapters/postgres.ts";
import { createRedisKv } from "./adapters/redis.ts";
import { createValkeyKv } from "./adapters/valkey.ts";
import { env } from "./env.ts";

let kv: Keyv | null = null;

export const createKeyv = () => {
  if (kv) {
    return kv;
  }

  switch (env.CACHE_PROVIDER) {
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
    case "auto": {
      const protocol =
        env.CACHE_URI &&
        isUrl(env.CACHE_URI, {
          allowedProtocols: [
            "redis",
            "valkey",
            "rediss",
            "valkeys",
            "postgres",
          ],
        })
          ? new URL(env.CACHE_URI).protocol.replace(":", "")
          : null;
      switch (protocol) {
        case "rediss":
        case "redis": {
          kv = createRedisKv();
          break;
        }
        case "valkeys":
        case "valkey": {
          kv = createValkeyKv();
          break;
        }
        case "postgres": {
          kv = createPostgresKv();
          break;
        }
        default:
          throw new Error(`Unsupported protocol: ${protocol}`);
      }
      break;
    }
    default:
      throw new Error(`Unsupported provider: ${env.CACHE_PROVIDER}`);
  }
  return kv;
};
