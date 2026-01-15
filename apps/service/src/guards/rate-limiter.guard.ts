import { rateLimiter } from "hono-rate-limiter";
import type {
  Store,
  ClientRateLimitInfo,
  HonoConfigType,
} from "hono-rate-limiter";
import { createMiddleware } from "hono/factory";

import type { Keyv } from "@chia/kv";
import { getClientIP } from "@chia/utils/server";

import { env } from "@/env";

interface RateLimitEntry {
  totalHits: number;
  resetTime: number;
}

class KeyvStore implements Store<HonoContext> {
  windowMs = 0;
  kv: Keyv | null = null;

  constructor(kv?: Keyv) {
    this.kv = kv ?? null;
  }

  init(options: HonoConfigType<HonoContext>) {
    this.windowMs = options.windowMs;
  }

  private initKv(kv?: Keyv) {
    this.kv = kv ? kv : this.kv;
  }

  async get(key: string, kv?: Keyv): Promise<ClientRateLimitInfo | undefined> {
    this.initKv(kv);

    if (!this.kv) {
      return undefined;
    }

    const data = await this.kv.get<RateLimitEntry>(key);
    if (!data) {
      return undefined;
    }

    const resetTime = new Date(data.resetTime);
    if (Number.isNaN(resetTime.getTime())) {
      return undefined;
    }

    return { totalHits: data.totalHits, resetTime };
  }

  async increment(key: string, kv?: Keyv): Promise<ClientRateLimitInfo> {
    this.initKv(kv);

    if (!this.kv) {
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }

    const now = Date.now();
    const data = await this.kv.get<RateLimitEntry>(key);

    if (!data || data.resetTime <= now) {
      const resetTime = now + this.windowMs;
      await this.kv.set(key, { totalHits: 1, resetTime }, this.windowMs);
      return { totalHits: 1, resetTime: new Date(resetTime) };
    }

    const totalHits = data.totalHits + 1;
    const ttl = Math.max(data.resetTime - now, 0);
    await this.kv.set(key, { totalHits, resetTime: data.resetTime }, ttl);

    return { totalHits, resetTime: new Date(data.resetTime) };
  }

  async decrement(key: string, kv?: Keyv): Promise<void> {
    this.initKv(kv);

    if (!this.kv) {
      return;
    }

    const now = Date.now();
    const data = await this.kv.get<RateLimitEntry>(key);
    if (!data || data.resetTime <= now) {
      return;
    }

    const totalHits = Math.max(data.totalHits - 1, 0);
    const ttl = Math.max(data.resetTime - now, 0);
    if (totalHits === 0) {
      await this.kv.delete(key);
      return;
    }

    await this.kv.set(key, { totalHits, resetTime: data.resetTime }, ttl);
  }

  async resetKey(key: string, kv?: Keyv): Promise<void> {
    this.initKv(kv);

    if (!this.kv) {
      return;
    }

    await this.kv.delete(key);
  }

  async resetAll(kv?: Keyv): Promise<void> {
    this.initKv(kv);

    if (!this.kv) {
      return;
    }

    await this.kv.clear();
  }

  async shutdown(kv?: Keyv): Promise<void> {
    this.initKv(kv);

    if (!this.kv) {
      return;
    }

    await this.kv.disconnect();
  }
}

export const rateLimiterGuard = (options?: {
  windowMs?: number;
  limit?: number;
  standardHeaders?: "draft-6" | "draft-7";
  prefix?: string;
}) =>
  createMiddleware<HonoContext>(async (c, next) => {
    const {
      windowMs,
      limit,
      standardHeaders,
      prefix = "rate-limiter:root-request",
    } = options ?? {};
    return rateLimiter<HonoContext>({
      windowMs: windowMs ?? env.RATELIMIT_WINDOW_MS,
      limit: limit ?? env.RATELIMIT_MAX,
      standardHeaders: standardHeaders ?? "draft-6", // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
      keyGenerator: (c) => {
        let info: string | null | undefined = null;
        try {
          info = getClientIP(c.req.raw);
        } catch (e) {
          console.error(e);
          info = null;
        }
        const key = `${prefix}:ip-${info}`;
        console.log(key);
        return key;
      },
      /**
       * @TODO: Avoid re-creating the store instance on each request
       */
      store: new KeyvStore(c.var.kv),
    })(c, next);
  });
