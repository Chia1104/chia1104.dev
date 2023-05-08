"use server";

import { z } from "zod";
import { zact } from "zact/server";
import redis from "../db/kv.db";

const incrReadCount = (id: string) => {
  void redis.incr(id);
};

const validatedIncrReadCount = zact(z.object({ slug: z.string().min(1) }))(
  async (input) => {
    void redis.incr(input.slug);
  }
);

export { incrReadCount, validatedIncrReadCount };
