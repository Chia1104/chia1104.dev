import { Redis as Upstash } from "@upstash/redis";
import { env } from "./env";

export type UpstashConfig = {
  token?: string;
  url?: string;
};

export const createUpstash = (config?: UpstashConfig) => {
  return new Upstash({
    url: config?.url ?? env.REDIS_URL!,
    token: config?.token ?? env.UPSTASH_TOKEN!,
  });
};
