import Redis from "ioredis";

import { env } from "./env";

export interface RedisConfig {
  url?: string;
}

export const createRedis = (config?: RedisConfig | string) => {
  if (typeof config === "string") {
    return new Redis(config);
  }
  return new Redis(config?.url ?? env.REDIS_URI ?? env.REDIS_URL ?? "");
};
export { Redis };
