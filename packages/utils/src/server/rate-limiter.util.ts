import Redis from "ioredis";

type Result = {
  limit: number;
  remaining: number;
  success: boolean;
};

const rateLimiter = async ({
  client,
  ip,
  limit,
  duration,
  prefix = "rate-limiter",
}: {
  client: Redis;
  ip: string;
  limit: number;
  duration: number;
  prefix?: string;
}): Promise<Result> => {
  const key = `${prefix}:${ip}`;
  const currentCount = await client.get(key);
  const count = parseInt(currentCount as string, 10) || 0;
  if (count >= limit) {
    return { limit, remaining: limit - count, success: false };
  }
  client.incr(key);
  client.expire(key, duration);
  return { limit, remaining: limit - (count + 1), success: true };
};

export default rateLimiter;
