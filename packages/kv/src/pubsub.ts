import { createClient } from "@redis/client";
import type { RedisClientType } from "@redis/client";

import { resolveCacheProvider } from "./clients.ts";
import { env } from "./env.ts";

/**
 * Redis pub/sub, deliberately separate from the Keyv cache client.
 *
 * Two reasons it cannot reuse `getRedisKv()`: a node-redis connection in subscriber mode refuses
 * ordinary commands, so publishing and subscribing need one connection each; and reaching into
 * `keyv.store.client` would couple us to `@keyv/redis` internals for something it does not expose
 * as a feature.
 *
 * Fire-and-forget by design. Nothing here is durable — callers must treat a delivered message as an
 * optimisation and keep whatever durable path they already had.
 */

export interface RedisPubSub {
  publish(channel: string, message?: string): Promise<void>;
  /** Resolves to an unsubscribe function that removes only this listener. */
  subscribe(
    channel: string,
    listener: (message: string) => void
  ): Promise<() => Promise<void>>;
}

const redisUri = () =>
  env.CACHE_URI ?? env.REDIS_URI ?? "redis://localhost:6379";

/**
 * Connections are created on first use and kept for the process's life.
 *
 * The `error` listener is not optional: an unhandled `error` event on a node-redis client crashes
 * the process, and a pub/sub channel losing its connection must never do that — the caller's
 * durable path is still there.
 */
const connect = (
  uri: string
): { client: RedisClientType; ready: Promise<void> } => {
  const client = createClient({ url: uri }) as RedisClientType;
  client.on("error", () => undefined);
  return { client, ready: client.connect().then(() => undefined) };
};

const createRedisPubSub = (uri = redisUri()): RedisPubSub => {
  let publisher: ReturnType<typeof connect> | undefined;
  let subscriber: ReturnType<typeof connect> | undefined;

  const publisherReady = async () => {
    publisher ??= connect(uri);
    await publisher.ready;
    return publisher.client;
  };

  const subscriberReady = async () => {
    subscriber ??= connect(uri);
    await subscriber.ready;
    return subscriber.client;
  };

  return {
    async publish(channel, message = "") {
      const client = await publisherReady();
      await client.publish(channel, message);
    },
    async subscribe(channel, listener) {
      const client = await subscriberReady();
      const handler = (message: string) => listener(message);
      await client.subscribe(channel, handler);
      // node-redis tracks listeners per channel itself, so passing the same handler back is enough
      // to detach exactly this subscription without disturbing any other.
      return async () => {
        await client.unsubscribe(channel, handler);
      };
    },
  };
};

let cached: RedisPubSub | null | undefined;

/**
 * The process-wide pub/sub handle, or `null` when the cache is not Redis.
 *
 * `upstash` speaks HTTP REST and has no `SUBSCRIBE` at all; `postgres` and `valkey` would each need
 * their own adapter. Callers are expected to degrade rather than fail — see
 * {@link RedisPubSub}.
 */
export const getRedisPubSub = (): RedisPubSub | null => {
  if (cached !== undefined) return cached;
  cached = resolveCacheProvider() === "redis" ? createRedisPubSub() : null;
  return cached;
};
