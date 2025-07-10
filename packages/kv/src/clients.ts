import { createKeyv as createPostgres } from "@keyv/postgres";
import { createKeyv as createRedis } from "@keyv/redis";
import { createKeyv as createValkey } from "@keyv/valkey";
import type { Keyv } from "keyv";

import { isUrl } from "@chia/utils/is-url";

import { env } from "./env";

let kv: Keyv | null = null;

export const createKeyv = () => {
  if (kv) {
    return kv;
  }

  switch (env.CACHE_PROVIDER) {
    case "redis": {
      kv = createRedis(
        env.CACHE_URI ?? env.REDIS_URI ?? "redis://localhost:6379"
      );
      break;
    }
    case "valkey": {
      kv = createValkey(
        env.CACHE_URI ?? env.VALKEY_URI ?? "valkey://localhost:6379"
      );
      break;
    }
    case "postgres": {
      kv = createPostgres({
        uri:
          env.CACHE_URI ??
          env.POSTGRES_URI ??
          "postgres://localhost:5432/postgres",
      });
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
          kv = createRedis(
            env.CACHE_URI ?? env.REDIS_URI ?? "redis://localhost:6379"
          );
          break;
        }
        case "valkeys":
        case "valkey": {
          kv = createValkey(
            env.CACHE_URI ?? env.VALKEY_URI ?? "valkey://localhost:6379"
          );
          break;
        }
        case "postgres": {
          kv = createPostgres({
            uri:
              env.CACHE_URI ??
              env.POSTGRES_URI ??
              "postgres://localhost:5432/postgres",
          });
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
