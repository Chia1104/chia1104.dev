"use server";

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.REDIS_URL ?? "",
  token: process.env.UPSTASH_TOKEN ?? "",
});

const incrReadCount = async (id: string) => {
  await redis.incr(id);
};

export { incrReadCount };
