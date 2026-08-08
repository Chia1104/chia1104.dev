import { createClient } from "@redis/client";
import type { RedisClientType } from "@redis/client";

import { env } from "./env.ts";
import type { CacheProvider } from "./provider.ts";
import { resolveCacheProvider } from "./provider.ts";

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
 *
 * `disableOfflineQueue` keeps a command issued while the socket is down from sitting in memory until
 * a reconnect that may never come: teardown awaits the subscribe, so a queued command is a hang, and
 * a rejection is exactly the "fall back to the durable path" signal callers already handle.
 * `socketTimeout` is deliberately left unset — it closes *idle* sockets, and a subscriber is idle by
 * definition between messages.
 */
const connect = (
  uri: string
): { client: RedisClientType; ready: Promise<void> } => {
  const client = createClient({
    url: uri,
    disableOfflineQueue: true,
  }) as RedisClientType;
  client.on("error", () => undefined);
  return { client, ready: client.connect().then(() => undefined) };
};

/** Holds a connection so a failed one can be dropped and retried by the next caller. */
interface Slot {
  handle?: ReturnType<typeof connect>;
}

const createRedisPubSub = (uri = redisUri()): RedisPubSub => {
  const publisher: Slot = {};
  const subscriber: Slot = {};

  /**
   * A rejected `ready` must never be memoised.
   *
   * node-redis reconnects on its own only *after* a successful first connect, so caching the handle
   * from a failed one would hand every later call the same rejection for the process's life — the
   * accelerator would stay dead long after Redis came back.
   */
  const clientOf = async (slot: Slot) => {
    const handle = (slot.handle ??= connect(uri));
    try {
      await handle.ready;
    } catch (error) {
      if (slot.handle === handle) slot.handle = undefined;
      try {
        handle.client.destroy();
      } catch {
        // Already closed by the failure itself; nothing left to release.
      }
      throw error;
    }
    return handle.client;
  };

  return {
    async publish(channel, message = "") {
      const client = await clientOf(publisher);
      await client.publish(channel, message);
    },
    async subscribe(channel, listener) {
      const client = await clientOf(subscriber);
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
  let provider: CacheProvider | null;
  try {
    provider = resolveCacheProvider();
  } catch {
    // `resolveCacheProvider` throws on a cache configuration it cannot read. That is a real problem
    // for the cache, but not for callers here: degrading to `null` is the whole contract, and
    // rethrowing would fail an agent turn over an optimisation it never needed.
    provider = null;
  }
  cached = provider === "redis" ? createRedisPubSub() : null;
  return cached;
};
