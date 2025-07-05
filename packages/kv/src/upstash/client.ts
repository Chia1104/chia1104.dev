import { Redis as Upstash } from "@upstash/redis";

export const client = Upstash.fromEnv();
