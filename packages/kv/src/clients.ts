import KeyvPostgres from "@keyv/postgres";
import KeyvRedis from "@keyv/redis";
import KeyvValkey from "@keyv/valkey";

import { isUrl } from "@chia/utils/is-url";

import { env } from "./env";

export const redis = new KeyvRedis({
  url: env.REDIS_URI ?? "redis://localhost:6379",
});

export const valkey = new KeyvValkey(
  env.VALKEY_URI ?? "valkey://localhost:6379"
);

export const postgres = new KeyvPostgres(
  env.POSTGRES_URI ?? "postgres://localhost:5432/postgres"
);

export const getClient = () => {
  switch (env.CACHE_PROVIDER) {
    case "redis":
      return redis;
    case "valkey":
      return valkey;
    case "postgres":
      return postgres;
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
        case "redis":
          return redis;
        case "valkeys":
        case "valkey": {
          return valkey;
        }
        case "postgres":
          return postgres;
        default:
          throw new Error(`Unsupported protocol: ${protocol}`);
      }
    }
    default:
      throw new Error(`Unsupported provider: ${env.CACHE_PROVIDER}`);
  }
};
