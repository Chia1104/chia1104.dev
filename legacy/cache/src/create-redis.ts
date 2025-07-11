import type { RedisOptions } from "ioredis";
import Redis from "ioredis";

import { env } from "./env";

export interface RedisConfig extends RedisOptions {
  url?: string;
}

export const createRedis = (config?: RedisConfig | string) => {
  if (typeof config === "string") {
    return new Redis(config);
  }
  return new Redis(
    config?.url ?? env.REDIS_URI ?? env.REDIS_URL ?? "",
    config ?? {}
  );
};
export { Redis };
