import { getRedisKv } from "./adapters/redis.ts";

export const kv = getRedisKv();
export type { default as Keyv } from "keyv";
