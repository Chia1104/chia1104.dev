import { createKeyv } from "@keyv/redis";

import { env } from "../env.ts";

let redisKv: ReturnType<typeof createKeyv> | undefined;

export const createRedisKv = (
  uri = env.CACHE_URI ?? env.REDIS_URI ?? "redis://localhost:6379"
) => createKeyv(uri);

export const getRedisKv = () => {
  redisKv ??= createRedisKv();
  return redisKv;
};
