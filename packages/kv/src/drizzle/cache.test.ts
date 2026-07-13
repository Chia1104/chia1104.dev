import Keyv from "keyv";

import { DrizzleCache } from "./cache";

describe("DrizzleCache", () => {
  it("uses explicit caching by default", () => {
    const cache = new DrizzleCache(new Keyv());

    expect(cache.strategy()).toBe("explicit");
  });

  it("invalidates table entries across cache instances", async () => {
    const kv = new Keyv();
    const writer = new DrizzleCache(kv);
    const invalidator = new DrizzleCache(kv);

    await writer.put("feed-query", [{ id: 1 }], ["feed"], false);
    expect(await invalidator.get("feed-query")).toEqual([{ id: 1 }]);

    await invalidator.onMutate({ tables: "feed" });

    expect(await writer.get("feed-query")).toBeUndefined();
  });

  it("invalidates tagged entries", async () => {
    const kv = new Keyv();
    const cache = new DrizzleCache(kv);

    await cache.put("feed:1", [{ id: 1 }], ["feed"], true);
    await cache.onMutate({ tags: "feed:1" });

    expect(await cache.get("feed:1")).toBeUndefined();
  });
});
