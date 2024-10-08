import { Redis as Upstash } from "@upstash/redis";
import Redis from "ioredis";

import type { RedisConfig } from "./create-redis";
import type { UpstashConfig } from "./create-upstash";
import { env } from "./env";

export type Config =
  | ({
      provider?: "upstash";
    } & UpstashConfig)
  | ({
      provider?: "redis";
    } & RedisConfig & { token?: never })
  | string;

export const createClient = (config?: Config) => {
  try {
    if (typeof config === "string") {
      return new Redis(config);
    }
    switch (config?.provider ?? env.CACHE_PROVIDER) {
      case "upstash": {
        return new Upstash({
          url: config?.url ?? env.REDIS_URL,
          token: config?.token ?? env.UPSTASH_TOKEN,
          ...config,
        });
      }
      case "redis": {
        return new Redis(config?.url ?? env.REDIS_URI ?? env.REDIS_URL ?? "");
      }
      default: {
        return new Redis(config?.url ?? env.REDIS_URI ?? env.REDIS_URL ?? "");
      }
    }
  } catch (error) {
    console.error("Error creating Redis client:", error);
    return null;
  }
};
