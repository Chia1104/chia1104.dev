import { Ratelimit } from "@upstash/ratelimit";
import type { RatelimitConfig } from "@upstash/ratelimit";
import type { Redis as Upstash } from "@upstash/redis";

import { getIP } from "./utils";

export const withRateLimiter = <
  TResponse extends Response,
  TError extends Error,
  TRequest extends Request,
>(
  handler: (
    req: TRequest,
    res: TResponse,
    ip: string
  ) => TResponse | Promise<TResponse> | void | Promise<void>,
  config: {
    client: Upstash;
    onLimitReached?: ({
      limit,
      remaining,
      reset,
    }: {
      /**
       * Maximum number of requests allowed within a window.
       */
      limit: number;
      /**
       * How many requests the user has left within the current window.
       */
      remaining: number;
      /**
       * Unix timestamp in milliseconds when the limits are reset.
       */
      reset: number;
    }) => TResponse | Promise<TResponse> | void;
    ratelimit?: Ratelimit | RatelimitConfig;
    onError?: (error: TError) => TResponse | Promise<TResponse> | void;
  }
) => {
  try {
    return async (req: TRequest, res: TResponse) => {
      const client = config.client;
      const ratelimit =
        config?.ratelimit instanceof Ratelimit
          ? config.ratelimit
          : new Ratelimit(
              config.ratelimit ?? {
                redis: client,
                analytics: true,
                timeout: 1000,
                limiter: Ratelimit.slidingWindow(2, "5s"),
                prefix: "rate-limiter",
              }
            );
      const id = getIP(req) ?? "anonymous";
      const { success, limit, reset, remaining } = await ratelimit.limit(
        id,
        // @ts-expect-error - are we cool?
        req
      );
      if (!success) {
        if (config.onLimitReached) {
          return config.onLimitReached({
            limit,
            remaining,
            reset,
          });
        }
        return;
      }
      return handler(req, res, id);
    };
  } catch (error) {
    if (config.onError) {
      return config.onError(error as TError);
    }
  }
};
