"use server";

import { Redis } from "@upstash/redis";
import { z } from "zod";
import { zact } from "zact/server";

const redis = new Redis({
  url: process.env.REDIS_URL ?? "",
  token: process.env.UPSTASH_TOKEN ?? "",
});

const incrReadCount = (id: string) => {
  void redis.incr(id);
};

const validatedIncrReadCount = zact(z.object({ slug: z.string().min(1) }))(
  async (input) => {
    void redis.incr(input.slug);
  }
);

export { incrReadCount, validatedIncrReadCount };
