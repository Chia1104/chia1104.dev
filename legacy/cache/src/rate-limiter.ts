import type Redis from "ioredis";

interface Result {
  /**
   * Maximum number of requests allowed within a window.
   */
  limit: number;
  /**
   * How many requests the user has left within the current window.
   */
  remaining: number;
  /**
   * Whether the request may pass(true) or exceeded the limit(false)
   */
  success: boolean;
}

export const rateLimiter = async ({
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
  const currentCount = (await client.get(key)) ?? "0";
  const count = parseInt(currentCount, 10);
  if (count >= limit) {
    return {
      limit,
      remaining: limit - count,
      success: false,
    };
  }
  void client.incr(key);
  void client.expire(key, duration);
  return {
    limit,
    remaining: limit - (count + 1),
    success: true,
  };
};
