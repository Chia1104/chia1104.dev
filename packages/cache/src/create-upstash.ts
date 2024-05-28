import { Redis as Upstash } from "@upstash/redis";
import type { RedisConfigNodejs } from "@upstash/redis";
import { env } from "./env";

export type UpstashConfig = Partial<RedisConfigNodejs>;

export const createUpstash = (config?: Partial<RedisConfigNodejs>) => {
  return new Upstash({
    url: config?.url ?? env.REDIS_URL,
    token: config?.token ?? env.UPSTASH_TOKEN,
    ...config,
  });
};
